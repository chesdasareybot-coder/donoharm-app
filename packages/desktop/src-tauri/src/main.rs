// Prevents console/CMD window from appearing on Windows
#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use std::fs::OpenOptions;

#[cfg(target_os = "windows")]
static CLAIMED_SLOT_MUTEX: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);

#[cfg(target_os = "windows")]
fn setup_multi_instance_environment() {
    use std::ffi::c_void;

    type DWORD = u32;

    #[link(name = "kernel32")]
    extern "system" {
        fn CreateMutexA(
            lpMutexAttributes: *mut c_void,
            bInitialOwner: i32,
            lpName: *const i8,
        ) -> *mut c_void;
        fn GetLastError() -> DWORD;
    }

    // Attempt to claim an instance slot (1..=32)
    let mut claimed_slot = 1;
    for slot in 1..=32 {
        let name = std::ffi::CString::new(format!("Local\\DoNoHarmInstanceSlot_{}", slot)).unwrap();
        unsafe {
            let handle = CreateMutexA(std::ptr::null_mut(), 1, name.as_ptr());
            if !handle.is_null() && GetLastError() != 183 {
                // Successfully claimed slot! Leak the handle so it remains held for process lifetime
                claimed_slot = slot;
                CLAIMED_SLOT_MUTEX.store(handle as usize, std::sync::atomic::Ordering::Relaxed);
                break;
            }
        }
    }

    // Each instance gets its own WebView2 User Data Folder
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let folder = std::path::PathBuf::from(local_app_data)
            .join("com.donoharm.app")
            .join(format!("instance_{}", claimed_slot));
        let _ = std::fs::create_dir_all(&folder);
        std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", &folder);
    }
}

fn main() {
    #[cfg(target_os = "windows")]
    setup_multi_instance_environment();

    std::panic::set_hook(Box::new(|info| {
        let msg = format!("PANIC: {:?}\n", info);
        let _ = std::fs::write("C:\\Users\\AORUS\\hackerai-ollama\\desktop_panic.log", &msg);
    }));

    if let Ok(file) = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open("C:\\Users\\AORUS\\hackerai-ollama\\desktop_debug.log")
    {
        let target = env_logger::Target::Pipe(Box::new(file));
        let _ = env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
            .target(target)
            .try_init();
    } else {
        env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    }

    hackerai_desktop_lib::run()
}
