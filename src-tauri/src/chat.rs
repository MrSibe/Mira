use crate::database::{self, DbState};
use crate::memory;
use crate::model;
use crate::secrets;
use crate::types::{
    ChatMessage, Conversation, Memory, MemoryPatch, MessageStreamDelta, ModelConfig, ModelSettings,
    Project, SearchResult, SendMessageResult, TavilyConfig,
};
use crate::web_search;
use tauri::{AppHandle, Emitter, Manager, State, Window};

#[tauri::command]
pub fn list_conversations(state: State<'_, DbState>) -> Result<Vec<Conversation>, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::list_conversations(&conn)
}

#[tauri::command]
pub fn list_archived_conversations(state: State<'_, DbState>) -> Result<Vec<Conversation>, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::list_archived_conversations(&conn)
}

#[tauri::command]
pub fn create_conversation(
    state: State<'_, DbState>,
    title: Option<String>,
    project_id: Option<String>,
) -> Result<Conversation, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::create_conversation(&conn, title, project_id)
}

#[tauri::command]
pub fn archive_conversation(
    state: State<'_, DbState>,
    conversation_id: String,
) -> Result<(), String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::archive_conversation(&conn, &conversation_id)
}

#[tauri::command]
pub fn restore_conversation(
    state: State<'_, DbState>,
    conversation_id: String,
) -> Result<Conversation, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::restore_conversation(&conn, &conversation_id)
}

#[tauri::command]
pub fn delete_conversation(
    state: State<'_, DbState>,
    conversation_id: String,
) -> Result<(), String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::delete_conversation(&conn, &conversation_id)
}

#[tauri::command]
pub fn move_conversation_to_project(
    state: State<'_, DbState>,
    conversation_id: String,
    project_id: Option<String>,
) -> Result<Conversation, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::move_conversation_to_project(&conn, &conversation_id, project_id.as_deref())
}

#[tauri::command]
pub fn list_projects(state: State<'_, DbState>) -> Result<Vec<Project>, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::list_projects(&conn)
}

#[tauri::command]
pub fn create_project(state: State<'_, DbState>, name: String) -> Result<Project, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("项目名称不能为空".to_string());
    }
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::create_project(&conn, trimmed.to_string())
}

#[tauri::command]
pub fn delete_project(state: State<'_, DbState>, project_id: String) -> Result<(), String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::delete_project(&conn, &project_id)
}

#[tauri::command]
pub fn rename_project(
    state: State<'_, DbState>,
    project_id: String,
    name: String,
) -> Result<Project, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::rename_project(&conn, &project_id, &name)
}

#[tauri::command]
pub fn get_conversation_messages(
    state: State<'_, DbState>,
    conversation_id: String,
) -> Result<Vec<ChatMessage>, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::list_messages(&conn, &conversation_id)
}

#[tauri::command]
pub async fn send_message(
    window: Window,
    app: AppHandle,
    state: State<'_, DbState>,
    conversation_id: Option<String>,
    content: String,
    model_config_id: Option<String>,
    project_id: Option<String>,
    request_id: Option<String>,
    with_search: Option<bool>,
) -> Result<SendMessageResult, String> {
    let trimmed = content.trim().to_string();
    if trimmed.is_empty() {
        return Err("消息不能为空".to_string());
    }
    let request_id = request_id.unwrap_or_else(database::new_id);

    let (
        conversation,
        user_message,
        history,
        project_context,
        model_config,
        background_model_config,
        injected_memories,
    ) = {
        let conn = state
            .conn
            .lock()
            .map_err(|_| "Database lock is poisoned".to_string())?;
        let conversation = match conversation_id {
            Some(id) => database::get_conversation(&conn, &id)?
                .ok_or_else(|| format!("会话不存在: {id}"))?,
            None => {
                let title = title_from_content(&trimmed);
                database::create_conversation(&conn, Some(title), project_id)?
            }
        };
        let history = database::list_messages(&conn, &conversation.id)?;
        let project_context = if let Some(project_id) = conversation.project_id.as_deref() {
            database::project_context_messages(&conn, project_id, &conversation.id, &trimmed, 10)?
        } else {
            Vec::new()
        };
        let user_message = database::insert_message(&conn, &conversation.id, "user", &trimmed)?;
        let model_settings = database::get_model_settings(&conn)?;
        let chat_model_config_id = model_config_id
            .as_deref()
            .or(model_settings.chat_model_config_id.as_deref());
        let model_config = database::get_model_config(&conn, chat_model_config_id, true)?;
        let background_model_config =
            background_model_config(&conn, &model_config, &model_settings)?;
        let injected_memories = memory::inject_relevant_memories(&conn, &trimmed)?;
        database::touch_conversation(&conn, &conversation.id, None)?;
        (
            conversation,
            user_message,
            history,
            project_context,
            model_config,
            background_model_config,
            injected_memories,
        )
    };

    let stream_conversation_id = conversation.id.clone();
    let stream_request_id = request_id.clone();

    let tool_messages = if with_search.unwrap_or(false) {
        // Phase 1: non-streaming request with tool definition
        let api_key = model_config
            .api_key
            .clone()
            .filter(|v| !v.trim().is_empty() && v != "******")
            .ok_or_else(|| format!("模型配置 {} 缺少 API Key", model_config.name))?;

        let mut msgs = model::build_messages_for_search(
            &history,
            &project_context,
            &injected_memories,
            &trimmed,
        );

        let initial = model::complete_chat_non_streaming(
            &model_config,
            &api_key,
            &msgs,
            true,
        )
        .await?;

        if let Some(tool_calls) = initial.choices.first().and_then(|c| c.message.tool_calls.as_ref()) {
            if let Some(tool) = tool_calls.first() {
                if tool.function.name == "web_search" {
                    // Parse the search query from the tool call arguments
                    let args: serde_json::Value = serde_json::from_str(&tool.function.arguments)
                        .map_err(|e| format!("无法解析搜索参数: {e}"))?;
                    let query = args["query"].as_str()
                        .ok_or_else(|| "搜索参数中缺少 query 字段".to_string())?;

                    // Call Tavily
                    let tavily_key = secrets::load_tavily_api_key()?
                        .ok_or_else(|| "Tavily API Key 未配置".to_string())?;
                    let search_results = web_search::search_web(query, &tavily_key).await?;

                    let results_text = if search_results.is_empty() {
                        "No results found.".to_string()
                    } else {
                        search_results.iter().enumerate()
                            .map(|(i, r)| {
                                format!("[{}] {} | {}\n{}", i + 1, r.title, r.url, r.content)
                            })
                            .collect::<Vec<_>>()
                            .join("\n\n")
                    };

                    // Add assistant tool call message + tool result message
                    let tool_call_id = tool.id.clone();
                    msgs.push(model::openai_message("assistant", None, Some(vec![
                        model::OpenAiToolCall {
                            id: tool_call_id.clone(),
                            call_type: "function".to_string(),
                            function: model::ToolCallFunction {
                                name: tool.function.name.clone(),
                                arguments: tool.function.arguments.clone(),
                            },
                        }
                    ]), None));
                    msgs.push(model::openai_message("tool", Some(results_text), None, Some(tool_call_id)));
                }
            }
        }
        msgs
    } else {
        Vec::new()
    };

    let assistant_content = model::complete_chat_streaming(
        &model_config,
        &history,
        &project_context,
        &injected_memories,
        &trimmed,
        tool_messages,
        |delta| {
            window
                .emit(
                    "message_stream_delta",
                    MessageStreamDelta {
                        request_id: stream_request_id.clone(),
                        conversation_id: stream_conversation_id.clone(),
                        content: delta.to_string(),
                    },
                )
                .map_err(|error| format!("无法发送流式消息事件: {error}"))
        },
    )
    .await?;

    let (conversation, assistant_message) = {
        let conn = state
            .conn
            .lock()
            .map_err(|_| "Database lock is poisoned".to_string())?;
        let assistant_message =
            database::insert_message(&conn, &conversation.id, "assistant", &assistant_content)?;
        let updated_title = if conversation.title == "新对话" {
            Some(title_from_content(&trimmed))
        } else {
            None
        };
        database::touch_conversation(&conn, &conversation.id, updated_title.as_deref())?;
        let conversation = database::get_conversation(&conn, &conversation.id)?
            .ok_or_else(|| "会话写入后无法读取".to_string())?;
        (conversation, assistant_message)
    };

    observe_memory_in_background(
        app,
        background_model_config,
        conversation.id.clone(),
        trimmed,
        assistant_content,
    );

    Ok(SendMessageResult {
        conversation,
        user_message,
        assistant_message,
    })
}

fn background_model_config(
    conn: &rusqlite::Connection,
    chat_model_config: &ModelConfig,
    settings: &ModelSettings,
) -> Result<ModelConfig, String> {
    if settings.background_model_follows_chat {
        return Ok(chat_model_config.clone());
    }
    match settings.background_model_config_id.as_deref() {
        Some(id) => database::get_model_config(conn, Some(id), true),
        None => Ok(chat_model_config.clone()),
    }
}

fn observe_memory_in_background(
    app: AppHandle,
    model_config: ModelConfig,
    conversation_id: String,
    user_content: String,
    assistant_content: String,
) {
    tauri::async_runtime::spawn(async move {
        let decision =
            memory::plan_turn_memory_write(&model_config, &user_content, &assistant_content).await;
        let state = app.state::<DbState>();
        let Ok(conn) = state.conn.lock() else {
            return;
        };
        if let Ok(changed) = memory::observe_turn_with_decision(&conn, &conversation_id, decision) {
            if !changed.is_empty() {
                let _ = app.emit("memories_changed", ());
            }
        }
    });
}

#[tauri::command]
pub fn list_model_configs(state: State<'_, DbState>) -> Result<Vec<ModelConfig>, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::list_model_configs(&conn, false)
}

#[tauri::command]
pub fn save_model_config(
    state: State<'_, DbState>,
    config: ModelConfig,
) -> Result<ModelConfig, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::save_model_config(&conn, config)
}

#[tauri::command]
pub fn delete_model_config(
    state: State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::delete_model_config(&conn, &id)
}

#[tauri::command]
pub async fn search_web(state: State<'_, DbState>, query: String) -> Result<Vec<SearchResult>, String> {
    let api_key = {
        let conn = state
            .conn
            .lock()
            .map_err(|_| "Database lock is poisoned".to_string())?;
        let config = database::get_tavily_config(&conn)?;
        if !config.enabled {
            return Err("Web search is not enabled. Enable it in Settings.".to_string());
        }
        secrets::load_tavily_api_key()?
            .ok_or_else(|| "Tavily API key not configured.".to_string())?
    };
    web_search::search_web(&query, &api_key).await
}

#[tauri::command]
pub fn get_tavily_config(state: State<'_, DbState>) -> Result<TavilyConfig, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::get_tavily_config(&conn)
}

#[tauri::command]
pub fn save_tavily_config(
    state: State<'_, DbState>,
    enabled: bool,
    api_key: Option<String>,
) -> Result<TavilyConfig, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::save_tavily_config(&conn, enabled, api_key.as_deref())
}

#[tauri::command]
pub fn get_model_settings(state: State<'_, DbState>) -> Result<ModelSettings, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::get_model_settings(&conn)
}

#[tauri::command]
pub fn save_model_settings(
    state: State<'_, DbState>,
    settings: ModelSettings,
) -> Result<ModelSettings, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::save_model_settings(&conn, settings)
}

#[tauri::command]
pub fn list_memories(
    state: State<'_, DbState>,
    query: Option<String>,
    tags: Option<Vec<String>>,
    archived: Option<bool>,
) -> Result<Vec<Memory>, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::list_memories(&conn, query, tags, archived)
}

#[tauri::command]
pub fn create_saved_memory(state: State<'_, DbState>, fact: String) -> Result<Memory, String> {
    let trimmed = fact.trim();
    if trimmed.is_empty() {
        return Err("记忆不能为空".to_string());
    }
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::insert_saved_memory(&conn, trimmed)
}

#[tauri::command]
pub fn update_memory(
    state: State<'_, DbState>,
    id: i64,
    patch: MemoryPatch,
) -> Result<Memory, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    let current = database::get_memory(&conn, id)?;
    if current.memory_type.as_deref() != Some("saved") {
        return Err("只有 saved 记忆可以手动编辑".to_string());
    }
    database::update_memory(&conn, id, patch)
}

#[tauri::command]
pub fn delete_memory(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    database::delete_memory(&conn, id)
}

#[tauri::command]
pub fn run_memory_cleanup(state: State<'_, DbState>) -> Result<usize, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock is poisoned".to_string())?;
    memory::run_cleanup(&conn)
}

fn title_from_content(content: &str) -> String {
    let title: String = content.chars().take(24).collect();
    if title.is_empty() {
        "新对话".to_string()
    } else {
        title
    }
}
