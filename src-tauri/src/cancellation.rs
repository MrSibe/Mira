use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::State;

pub struct CancellationState {
    pub cancel_requested: Arc<AtomicBool>,
}

impl CancellationState {
    pub fn new() -> Self {
        Self {
            cancel_requested: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn reset(&self) {
        self.cancel_requested.store(false, Ordering::SeqCst);
    }
}

#[tauri::command]
pub fn cancel_message(state: State<'_, CancellationState>) -> Result<(), String> {
    state.cancel_requested.store(true, Ordering::SeqCst);
    Ok(())
}
