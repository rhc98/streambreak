use serde::Serialize;
use std::time::Instant;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum State {
    Idle,
    Counting,
    Triggered,
    Showing,
}

#[derive(Debug, Serialize)]
pub struct TimerStatus {
    pub elapsed_ms: u64,
    pub popup_visible: bool,
    pub mode: String,
}

pub struct Timer {
    state: State,
    started_at: Option<Instant>,
    threshold_secs: u64,
}

impl Timer {
    pub fn new(threshold_secs: u64) -> Self {
        Self {
            state: State::Idle,
            started_at: None,
            threshold_secs,
        }
    }

    pub fn start(&mut self) {
        self.state = State::Counting;
        self.started_at = Some(Instant::now());
    }

    pub fn check_threshold(&mut self) -> bool {
        if self.state != State::Counting {
            return false;
        }
        if let Some(start) = self.started_at {
            if start.elapsed().as_secs() >= self.threshold_secs {
                self.state = State::Triggered;
                return true;
            }
        }
        false
    }

    pub fn show(&mut self) {
        self.state = State::Showing;
    }

    pub fn hide(&mut self) {
        self.state = State::Idle;
        self.started_at = None;
    }

    pub fn status(&self) -> TimerStatus {
        let elapsed_ms = self
            .started_at
            .map(|s| s.elapsed().as_millis() as u64)
            .unwrap_or(0);

        let mode = match self.state {
            State::Idle => "idle",
            State::Counting => "counting",
            State::Triggered => "triggered",
            State::Showing => "showing",
        };

        TimerStatus {
            elapsed_ms,
            popup_visible: self.state == State::Showing,
            mode: mode.to_string(),
        }
    }

    pub fn state(&self) -> State {
        self.state
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_timer_is_idle() {
        let t = Timer::new(30);
        assert_eq!(t.state(), State::Idle);
        let s = t.status();
        assert_eq!(s.elapsed_ms, 0);
        assert!(!s.popup_visible);
    }

    #[test]
    fn test_start_changes_to_counting() {
        let mut t = Timer::new(30);
        t.start();
        assert_eq!(t.state(), State::Counting);
    }

    #[test]
    fn test_show_and_hide() {
        let mut t = Timer::new(30);
        t.start();
        t.show();
        assert_eq!(t.state(), State::Showing);
        assert!(t.status().popup_visible);
        t.hide();
        assert_eq!(t.state(), State::Idle);
        assert!(!t.status().popup_visible);
    }

    #[test]
    fn test_status_mode_strings() {
        let mut t = Timer::new(30);
        assert_eq!(t.status().mode, "idle");
        t.start();
        assert_eq!(t.status().mode, "counting");
        t.show();
        assert_eq!(t.status().mode, "showing");
        t.hide();
        assert_eq!(t.status().mode, "idle");
    }
}
