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
    thinking: Option<DeepSeekThinking>,
    #[serde(skip_serializing_if = "Option::is_none")]
    reasoning_effort: Option<String>,
}

#[derive(Debug, Serialize)]
struct DeepSeekThinking {
    #[serde(rename = "type")]
    thinking_type: String,
}

#[derive(Debug, Serialize)]
struct OpenAiMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionStreamChunk {
    choices: Vec<StreamChoice>,
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

pub async fn complete_chat_streaming<F, G>(
    config: &ModelConfig,
    history: &[ChatMessage],
    project_context: &[ChatMessage],
    injected_memories: &[Memory],
    user_content: &str,
    system_prompt_extra: &str,
    mut on_delta: F,
    mut on_reasoning: G,
) -> Result<String, String>
where
    F: FnMut(&str) -> Result<(), String>,
    G: FnMut(&str) -> Result<(), String>,
{
    let api_key = config
        .api_key
        .clone()
        .filter(|value| !value.trim().is_empty() && value != "******")
        .ok_or_else(|| format!("模型配置 {} 缺少 API Key", config.name))?;
    let endpoint = format!("{}/chat/completions", config.base_url.trim_end_matches('/'));
    let messages = build_messages(history, project_context, injected_memories, user_content, system_prompt_extra);
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
        append_stream_chunk(&mut buffer, &chunk, &mut full_content, &mut on_delta, &mut on_reasoning)?;
    }

    flush_stream_buffer(&mut buffer, &mut full_content, &mut on_delta, &mut on_reasoning)?;

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

fn append_stream_chunk<F, G>(
    buffer: &mut Vec<u8>,
    chunk: &[u8],
    full_content: &mut String,
    on_delta: &mut F,
    on_reasoning: &mut G,
) -> Result<(), String>
where
    F: FnMut(&str) -> Result<(), String>,
    G: FnMut(&str) -> Result<(), String>,
{
    buffer.extend_from_slice(chunk);
    while let Some((separator, separator_len)) = find_event_separator(buffer) {
        let raw_event = String::from_utf8(buffer[..separator].to_vec())
            .map_err(|error| format!("模型流式响应不是有效 UTF-8: {error}"))?;
        buffer.drain(..separator + separator_len);
        handle_stream_event(&raw_event, full_content, on_delta, on_reasoning)?;
    }
    Ok(())
}

fn flush_stream_buffer<F, G>(
    buffer: &mut Vec<u8>,
    full_content: &mut String,
    on_delta: &mut F,
    on_reasoning: &mut G,
) -> Result<(), String>
where
    F: FnMut(&str) -> Result<(), String>,
    G: FnMut(&str) -> Result<(), String>,
{
    if buffer.iter().all(|byte| byte.is_ascii_whitespace()) {
        buffer.clear();
        return Ok(());
    }
    let raw_event = String::from_utf8(std::mem::take(buffer))
        .map_err(|error| format!("模型流式响应不是有效 UTF-8: {error}"))?;
    if !raw_event.trim().is_empty() {
        handle_stream_event(&raw_event, full_content, on_delta, on_reasoning)?;
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
    lf.or(crlf)
}

fn handle_stream_event<F, G>(
    raw_event: &str,
    full_content: &mut String,
    on_delta: &mut F,
    on_reasoning: &mut G,
) -> Result<(), String>
where
    F: FnMut(&str) -> Result<(), String>,
    G: FnMut(&str) -> Result<(), String>,
{
    for line in raw_event.lines() {
        if let Some(data) = line.strip_prefix("data: ") {
            if data.trim() == "[DONE]" {
                return Ok(());
            }
            if let Ok(chunk) = serde_json::from_str::<ChatCompletionStreamChunk>(data) {
                if let Some(choice) = chunk.choices.first() {
                    if let Some(ref delta) = choice.delta.content {
                        full_content.push_str(delta);
                        on_delta(delta)?;
                    }
                    if let Some(ref reasoning) = choice.delta.reasoning_content {
                        // Don't add reasoning to full_content — keep it separate
                        on_reasoning(reasoning)?;
                    }
                }
            }
        }
    }
    Ok(())
}

fn build_messages(
    history: &[ChatMessage],
    project_context: &[ChatMessage],
    injected_memories: &[Memory],
    user_content: &str,
    system_prompt_extra: &str,
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
    let extra = if system_prompt_extra.is_empty() {
        String::new()
    } else {
        format!("\n\n用户自定义指令：\n{}", system_prompt_extra)
    };
    let mut messages = vec![OpenAiMessage {
        role: "system".to_string(),
        content: format!(
            "你是 Mira，一个本地个人 AI 记忆客户端。请自然使用长期记忆和项目上下文，但不要逐条暴露。\n\n长期记忆：\n{}\n\n同项目其他对话上下文：\n{}{}",
            memory_block, project_block, extra
        ),
    }];

    for message in history.iter().rev().take(20).rev() {
        if message.role == "user" || message.role == "assistant" {
            messages.push(OpenAiMessage {
                role: message.role.clone(),
                content: message.content.clone(),
            });
        }
    }
    messages.push(OpenAiMessage {
        role: "user".to_string(),
        content: user_content.to_string(),
    });
    messages
}

fn build_request(config: &ModelConfig, messages: Vec<OpenAiMessage>) -> ChatCompletionRequest {
    if supports_deepseek_reasoning(config) {
        return ChatCompletionRequest {
            model: config.model.clone(),
            messages,
            stream: true,
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

fn compact(content: &str, max_chars: usize) -> String {
    let mut compacted = content.split_whitespace().collect::<Vec<_>>().join(" ");
    if compacted.chars().count() > max_chars {
        compacted = compacted.chars().take(max_chars).collect::<String>();
        compacted.push_str("...");
    }
    compacted
}
