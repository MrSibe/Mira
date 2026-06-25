use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub is_archived: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub project_id: Option<String>,
    pub is_archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub id: String,
    pub provider: String,
    pub name: String,
    pub base_url: String,
    pub model: String,
    pub api_key: Option<String>,
    pub credential_status: Option<String>,
    pub credential_error: Option<String>,
    pub is_default: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelSettings {
    pub chat_model_config_id: Option<String>,
    pub background_model_config_id: Option<String>,
    pub background_model_follows_chat: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Memory {
    pub id: i64,
    pub fact: String,
    pub memory_type: Option<String>,
    pub importance: i64,
    pub confidence: f64,
    pub tags: Option<String>,
    pub source_conversation_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_used_at: Option<String>,
    pub use_count: i64,
    pub is_archived: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryPatch {
    pub fact: Option<String>,
    pub memory_type: Option<String>,
    pub importance: Option<i64>,
    pub confidence: Option<f64>,
    pub tags: Option<String>,
    pub is_archived: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMessageResult {
    pub conversation: Conversation,
    pub user_message: ChatMessage,
    pub assistant_message: ChatMessage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageStreamDelta {
    pub request_id: String,
    pub conversation_id: String,
    pub content: String,
}
