use crate::types::{ChatMessage, Memory, ModelConfig};
use futures_util::StreamExt;
use reqwest::{Client, Response, StatusCode};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::{sleep, timeout};

const MAX_REQUEST_ATTEMPTS: usize = 3;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const RESPONSE_HEADER_TIMEOUT: Duration = Duration::from_secs(45);

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<OpenAiMessage>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<ToolDefinition>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    thinking: Option<DeepSeekThinking>,
    #[serde(skip_serializing_if = "Option::is_none")]
    reasoning_effort: Option<String>,
}

#[derive(Debug, Serialize)]
struct ToolDefinition {
    #[serde(rename = "type")]
    tool_type: String,
    function: ToolFunction,
}

#[derive(Debug, Serialize)]
struct ToolFunction {
    name: String,
    description: String,
    parameters: serde_json::Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct OpenAiMessage {
    pub role: String,
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<OpenAiToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAiToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: String,
    pub function: ToolCallFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallFunction {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Serialize)]
struct DeepSeekThinking {
    #[serde(rename = "type")]
    thinking_type: String,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionStreamChunk {
    choices: Vec<StreamChoice>,
}

#[derive(Debug, Deserialize)]
pub struct ChatCompletionResponse {
    pub choices: Vec<ResponseChoice>,
}

#[derive(Debug, Deserialize)]
pub struct ResponseChoice {
    pub message: ResponseMessage,
    #[allow(dead_code)]
    pub finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ResponseMessage {
    #[allow(dead_code)]
    pub content: Option<String>,
    pub tool_calls: Option<Vec<OpenAiToolCall>>,
}

#[derive(Debug, Deserialize)]
struct StreamChoice {
    delta: StreamDelta,
}

#[derive(Debug, Deserialize)]
struct StreamDelta {
    content: Option<String>,
    #[allow(dead_code)]
    reasoning_content: Option<String>,
}

fn web_search_tool() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: ToolFunction {
            name: "web_search".to_string(),
            description: "Search the web for current information. Useful for news, real-time data, or topics you are not confident about.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query to look up"
                    }
                },
                "required": ["query"]
            }),
        },
    }
}

/// Non-streaming completion — used for the initial tool-call round.
pub async fn complete_chat_non_streaming(
    config: &ModelConfig,
    api_key: &str,
    messages: &[OpenAiMessage],
    with_search: bool,
) -> Result<ChatCompletionResponse, String> {
    let endpoint = format!("{}/chat/completions", config.base_url.trim_end_matches('/'));
    let mut request = ChatCompletionRequest {
        model: config.model.clone(),
        messages: messages.to_vec(),
        stream: false,
        tools: if with_search { Some(vec![web_search_tool()]) } else { None },
        thinking: None,
        reasoning_effort: None,
    };
    if config.provider.eq_ignore_ascii_case("deepseek") || config.base_url.contains("api.deepseek.com") {
        let is_reasoning = config.model.contains("reasoner");
        if is_reasoning {
            request.thinking = Some(DeepSeekThinking { thinking_type: "enabled".to_string() });
        } else {
            request.reasoning_effort = Some("medium".to_string());
        }
    }
    let client = Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .build()
        .map_err(|error| format!("客户端初始化失败: {error}"))?;
    let response = send_chat_completion_request(&client, &endpoint, api_key, &request).await?;
    let body = response.json::<ChatCompletionResponse>().await
        .map_err(|error| format!("解析非流式响应失败: {error}"))?;
    Ok(body)
}

pub async fn complete_chat_streaming<F>(
    config: &ModelConfig,
    history: &[ChatMessage],
    project_context: &[ChatMessage],
    injected_memories: &[Memory],
    user_content: &str,
    tool_messages: Vec<OpenAiMessage>,
    mut on_delta: F,
) -> Result<String, String>
where
    F: FnMut(&str) -> Result<(), String>,
{
    let api_key = config
        .api_key
        .clone()
        .filter(|value| !value.trim().is_empty() && value != "******")
        .ok_or_else(|| format!("模型配置 {} 缺少 API Key", config.name))?;
    let endpoint = format!("{}/chat/completions", config.base_url.trim_end_matches('/'));
    let mut messages = build_messages(history, project_context, injected_memories, user_content);
    messages.extend(tool_messages);
    let request = build_request(config, messages);
    let client = Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .build()
        .map_err(|error| format!("模型客户端初始化失败: {error}"))?;
    let response = send_chat_completion_request(&client, &endpoint, &api_key, &request).await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("模型请求失败: HTTP {status} {body}"));
    }

    let mut full_content = String::new();
    let mut buffer = Vec::new();
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| format!("模型流式响应读取失败: {error}"))?;
        append_stream_chunk(&mut buffer, &chunk, &mut full_content, &mut on_delta)?;
    }

    flush_stream_buffer(&mut buffer, &mut full_content, &mut on_delta)?;

    if full_content.trim().is_empty() {
        return Err("模型返回了空内容".to_string());
    }
    Ok(full_content)
}

async fn send_chat_completion_request(
    client: &Client,
    endpoint: &str,
    api_key: &str,
    request: &ChatCompletionRequest,
) -> Result<Response, String> {
    let mut last_error = None;
    for attempt in 1..=MAX_REQUEST_ATTEMPTS {
        let send_result = timeout(
            RESPONSE_HEADER_TIMEOUT,
            client
                .post(endpoint)
                .bearer_auth(api_key)
                .json(request)
                .send(),
        )
        .await;

        match send_result {
            Ok(Ok(response)) => {
                if should_retry_status(response.status()) && attempt < MAX_REQUEST_ATTEMPTS {
                    sleep(retry_delay(attempt)).await;
                    continue;
                }
                return Ok(response);
            }
            Ok(Err(error)) if is_retryable_send_error(&error) && attempt < MAX_REQUEST_ATTEMPTS => {
                last_error = Some(format!("模型请求失败: {error}"));
                sleep(retry_delay(attempt)).await;
            }
            Ok(Err(error)) => return Err(format!("模型请求失败: {error}")),
            Err(_) if attempt < MAX_REQUEST_ATTEMPTS => {
                last_error = Some("模型请求超时：等待响应头超过 45 秒".to_string());
                sleep(retry_delay(attempt)).await;
            }
            Err(_) => return Err("模型请求超时：等待响应头超过 45 秒".to_string()),
        }
    }
    Err(last_error.unwrap_or_else(|| "模型请求失败".to_string()))
}

fn should_retry_status(status: StatusCode) -> bool {
    status == StatusCode::TOO_MANY_REQUESTS || status.is_server_error()
}

fn is_retryable_send_error(error: &reqwest::Error) -> bool {
    error.is_timeout() || error.is_connect()
}

fn retry_delay(attempt: usize) -> Duration {
    Duration::from_millis(500 * attempt as u64)
}

fn append_stream_chunk<F>(
    buffer: &mut Vec<u8>,
    chunk: &[u8],
    full_content: &mut String,
    on_delta: &mut F,
) -> Result<(), String>
where
    F: FnMut(&str) -> Result<(), String>,
{
    buffer.extend_from_slice(chunk);
    while let Some((separator, separator_len)) = find_event_separator(buffer) {
        let raw_event = String::from_utf8(buffer[..separator].to_vec())
            .map_err(|error| format!("模型流式响应不是有效 UTF-8: {error}"))?;
        buffer.drain(..separator + separator_len);
        handle_stream_event(&raw_event, full_content, on_delta)?;
    }
    Ok(())
}

fn flush_stream_buffer<F>(
    buffer: &mut Vec<u8>,
    full_content: &mut String,
    on_delta: &mut F,
) -> Result<(), String>
where
    F: FnMut(&str) -> Result<(), String>,
{
    if buffer.iter().all(|byte| byte.is_ascii_whitespace()) {
        buffer.clear();
        return Ok(());
    }
    let raw_event = String::from_utf8(std::mem::take(buffer))
        .map_err(|error| format!("模型流式响应不是有效 UTF-8: {error}"))?;
    if !raw_event.trim().is_empty() {
        handle_stream_event(&raw_event, full_content, on_delta)?;
    }
    Ok(())
}

fn find_event_separator(buffer: &[u8]) -> Option<(usize, usize)> {
    let lf = buffer
        .windows(2)
        .position(|window| window == b"\n\n")
        .map(|index| (index, 2));
    let crlf = buffer
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|index| (index, 4));
    match (lf, crlf) {
        (Some(left), Some(right)) => Some(if left.0 <= right.0 { left } else { right }),
        (Some(item), None) | (None, Some(item)) => Some(item),
        (None, None) => None,
    }
}

fn handle_stream_event<F>(
    raw_event: &str,
    full_content: &mut String,
    on_delta: &mut F,
) -> Result<(), String>
where
    F: FnMut(&str) -> Result<(), String>,
{
    for line in raw_event.lines() {
        let line = line.trim();
        let Some(data) = line.strip_prefix("data:") else {
            continue;
        };
        let data = data.trim();
        if data.is_empty() || data == "[DONE]" {
            continue;
        }

        let chunk = serde_json::from_str::<ChatCompletionStreamChunk>(data)
            .map_err(|error| format!("模型流式响应解析失败: {error}"))?;
        for choice in chunk.choices {
            if let Some(content) = choice.delta.content {
                if content.is_empty() {
                    continue;
                }
                full_content.push_str(&content);
                on_delta(&content)?;
            }
        }
    }
    Ok(())
}

fn build_request(config: &ModelConfig, messages: Vec<OpenAiMessage>) -> ChatCompletionRequest {
    if supports_deepseek_reasoning(config) {
        return ChatCompletionRequest {
            model: config.model.clone(),
            messages,
            stream: true,
            tools: None,
            thinking: Some(DeepSeekThinking {
                thinking_type: "enabled".to_string(),
            }),
            reasoning_effort: Some("high".to_string()),
        };
    }

    ChatCompletionRequest {
        model: config.model.clone(),
        messages,
        stream: true,
        tools: None,
        thinking: None,
        reasoning_effort: None,
    }
}

fn is_deepseek_config(config: &ModelConfig) -> bool {
    config.provider.eq_ignore_ascii_case("deepseek") || config.base_url.contains("api.deepseek.com")
}

fn supports_deepseek_reasoning(config: &ModelConfig) -> bool {
    if !is_deepseek_config(config) {
        return false;
    }
    let model = config.model.to_lowercase();
    model.contains("v4") || model.contains("reasoner")
}

fn build_messages(
    history: &[ChatMessage],
    project_context: &[ChatMessage],
    injected_memories: &[Memory],
    user_content: &str,
) -> Vec<OpenAiMessage> {
    let memory_block = if injected_memories.is_empty() {
        "暂无长期记忆。".to_string()
    } else {
        injected_memories
            .iter()
            .map(|memory| format!("- {}", memory.fact))
            .collect::<Vec<_>>()
            .join("\n")
    };
    let project_block = if project_context.is_empty() {
        "当前会话不在项目中，或项目内暂无其他对话上下文。".to_string()
    } else {
        project_context
            .iter()
            .map(|message| {
                let role = if message.role == "user" {
                    "用户"
                } else {
                    "助手"
                };
                format!("- {role}: {}", compact(&message.content, 180))
            })
            .collect::<Vec<_>>()
            .join("\n")
    };
    let mut messages = vec![OpenAiMessage {
        role: "system".to_string(),
        content: Some(format!(
            "你是 Mira，一个本地个人 AI 记忆客户端。请自然使用长期记忆和项目上下文，但不要逐条暴露。\n\n长期记忆：\n{}\n\n同项目其他对话上下文：\n{}",
            memory_block, project_block
        )),
        tool_calls: None,
        tool_call_id: None,
    }];

    for message in history.iter().rev().take(20).rev() {
        if message.role == "user" || message.role == "assistant" {
            messages.push(OpenAiMessage {
                role: message.role.clone(),
                content: Some(message.content.clone()),
                tool_calls: None,
                tool_call_id: None,
            });
        }
    }
    messages.push(OpenAiMessage {
        role: "user".to_string(),
        content: Some(user_content.to_string()),
        tool_calls: None,
        tool_call_id: None,
    });
    messages
}

fn compact(content: &str, max_chars: usize) -> String {
    let mut compacted = content.split_whitespace().collect::<Vec<_>>().join(" ");
    if compacted.chars().count() > max_chars {
        compacted = compacted.chars().take(max_chars).collect::<String>();
        compacted.push_str("...");
    }
    compacted
}

/// Build the initial message list for the search tool-call round.
pub fn build_messages_for_search(
    history: &[ChatMessage],
    project_context: &[ChatMessage],
    injected_memories: &[Memory],
    user_content: &str,
) -> Vec<OpenAiMessage> {
    let memory_block = if injected_memories.is_empty() {
        "暂无长期记忆。".to_string()
    } else {
        injected_memories
            .iter()
            .map(|memory| format!("- {}", memory.fact))
            .collect::<Vec<_>>()
            .join("\n")
    };
    let project_block = if project_context.is_empty() {
        "当前会话不在项目中，或项目内暂无其他对话上下文。".to_string()
    } else {
        project_context
            .iter()
            .map(|message| {
                let role = if message.role == "user" { "用户" } else { "助手" };
                format!("- {role}: {}", compact(&message.content, 180))
            })
            .collect::<Vec<_>>()
            .join("\n")
    };
    let mut messages = vec![OpenAiMessage {
        role: "system".to_string(),
        content: Some(format!(
            "你是 Mira，一个本地个人 AI 记忆客户端。\n\n长期记忆：\n{}\n\n同项目其他对话上下文：\n{}",
            memory_block, project_block
        )),
        tool_calls: None,
        tool_call_id: None,
    }];
    for message in history.iter().rev().take(20).rev() {
        if message.role == "user" || message.role == "assistant" {
            messages.push(OpenAiMessage {
                role: message.role.clone(),
                content: Some(message.content.clone()),
                tool_calls: None,
                tool_call_id: None,
            });
        }
    }
    messages.push(OpenAiMessage {
        role: "user".to_string(),
        content: Some(user_content.to_string()),
        tool_calls: None,
        tool_call_id: None,
    });
    messages
}

pub fn openai_message(
    role: &str,
    content: Option<String>,
    tool_calls: Option<Vec<OpenAiToolCall>>,
) -> OpenAiMessage {
    OpenAiMessage {
        role: role.to_string(),
        content,
        tool_calls,
        tool_call_id: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stream_parser_keeps_split_utf8() {
        let event = r#"data: {"choices":[{"delta":{"content":"你好"}}]}"#;
        let payload = format!("{event}\n\n");
        let bytes = payload.as_bytes();
        let split = bytes
            .windows(3)
            .position(|window| window == "你".as_bytes())
            .expect("test payload should contain Chinese bytes")
            + 1;
        let mut buffer = Vec::new();
        let mut full_content = String::new();
        let mut deltas = Vec::new();

        append_stream_chunk(
            &mut buffer,
            &bytes[..split],
            &mut full_content,
            &mut |delta| {
                deltas.push(delta.to_string());
                Ok(())
            },
        )
        .expect("first chunk should buffer");
        append_stream_chunk(
            &mut buffer,
            &bytes[split..],
            &mut full_content,
            &mut |delta| {
                deltas.push(delta.to_string());
                Ok(())
            },
        )
        .expect("second chunk should parse");

        assert_eq!(full_content, "你好");
        assert_eq!(deltas, vec!["你好"]);
    }

    #[test]
    fn deepseek_reasoning_params_are_model_gated() {
        let config = ModelConfig {
            id: "deepseek".to_string(),
            provider: "deepseek".to_string(),
            name: "DeepSeek".to_string(),
            base_url: "https://api.deepseek.com".to_string(),
            model: "deepseek-chat".to_string(),
            api_key: None,
            credential_status: None,
            credential_error: None,
            is_default: false,
            created_at: None,
            updated_at: None,
        };
        assert!(!supports_deepseek_reasoning(&config));
        assert!(supports_deepseek_reasoning(&ModelConfig {
            model: "deepseek-v4-pro".to_string(),
            ..config
        }));
    }
}
