// Disposable source/coverage probes. NEVER merge this branch or use it for a baseline.
fn crap_acceptance_closure(value: i32) -> i32 {
    let operation = |input: i32| {
        if input < 0 {
            -1
        } else if input == 0 {
            0
        } else if input == 1 {
            1
        } else if input == 2 {
            2
        } else {
            3
        }
    };
    operation(value)
}

#[cfg(target_os = "macos")]
fn crap_acceptance_cfg_dead(value: i32) -> i32 {
    if value < 0 {
        -1
    } else if value == 0 {
        0
    } else {
        1
    }
}

fn crap_acceptance_mixed(value: i32) -> i32 {
    if value < 0 {
        -1
    } else if value == 0 {
        0
    } else if value == 1 {
        1
    } else {
        2
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn probe_covered_paths() {
        assert_eq!(crap_acceptance_closure(0), 0);
        assert_eq!(crap_acceptance_mixed(0), 0);
    }
}
