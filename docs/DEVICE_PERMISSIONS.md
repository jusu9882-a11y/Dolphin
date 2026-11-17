# Device Permissions and Privacy Standard

Status: required engineering and release standard for Dolphin-generated applications.

## Scope

Dolphin's current native host is Android. Android permissions and Google Play review requirements apply to Android packages distributed through Google Play. Microsoft Store policies apply to a future Windows package submitted to Microsoft Store; they do not govern an Android APK merely because Dolphin supports Windows as a development environment.

No framework can guarantee store approval. Dolphin must make compliant behavior the default, document remaining obligations, and give each app developer accurate control over the capabilities their app actually uses.

## Non-negotiable rules

1. **Least privilege:** declare and request only permissions needed by implemented, user-visible features. Never add every permission to every generated app.
2. **Just in time:** request dangerous/runtime permissions only when a user invokes the feature that needs them.
3. **Explain first:** show a clear, feature-specific in-app disclosure before the operating-system permission prompt. State what data/device capability is accessed, why, whether it leaves the device, and who receives it.
4. **Affirmative consent:** require an explicit user action. Opening a screen, continuing navigation, or dismissing a notice is not consent.
5. **Respect denial:** do not repeatedly pressure users or block unrelated app functionality. Offer a reasonable alternative where possible.
6. **No hidden collection:** no covert camera/microphone use, no unexpected background collection, and no bypassing OS permission indicators or controls.
7. **Data minimization:** process locally where practical, collect only what is necessary, protect transmitted/stored personal data, and provide controls to revoke access and delete app-held data.
8. **Transparent declarations:** app manifests, store declarations, privacy labels, descriptions, and actual runtime behavior must agree.
9. **No permission circumvention:** never evade Android, Windows, Google Play, or Microsoft Store capability checks.
10. **Third-party review:** audit SDKs and dependencies for collection behavior; the app publisher remains responsible for the final app.

## Android capability matrix

| Capability | Android treatment |
|---|---|
| Internet | `INTERNET` is a normal install-time manifest permission; use HTTPS for network traffic. |
| Camera | Declare `CAMERA` only for apps with a camera feature; request runtime permission when the feature is activated. |
| Microphone | Declare `RECORD_AUDIO` only for apps with an audio feature; request at feature use. |
| Accelerometer / gyroscope | Accessed through `SensorManager` without a runtime permission; Dolphin exposes one-shot readings and reports unavailable sensors. |
| GPS / location | Request the minimum coarse/fine location scope only when a location feature is used; background location needs separate justification and review. |
| Photos / videos | Prefer Android Photo Picker or Storage Access Framework over broad media/storage permissions. |
| Bluetooth / nearby devices | Use only the applicable API-level permissions for the actual Bluetooth operation. |
| Vibration | Declare `VIBRATE` only when haptic feedback is used. |
| Other sensors | Check the specific sensor/API permission model; do not assume all sensors share one permission. |

`INTERNET` and sensor access must not be confused with dangerous runtime permissions. Runtime permission prompts are not required for every hardware sensor.

## WebView camera and microphone boundary

The native WebView host must not grant web permissions automatically. Before granting `WebChromeClient.onPermissionRequest`:

- Verify the requesting origin is the trusted packaged app origin, or the explicitly permitted loopback development origin in debug builds only.
- Allow only the exact requested resources that Dolphin supports (camera and/or microphone); deny unknown resources and all untrusted origins.
- Check Android runtime permissions and request them through the native permission flow.
- Show a clear disclosure before the system prompt and grant only after the user agrees and Android grants access.
- Deny by default on cancellation, origin mismatch, missing permission, or lifecycle loss.
- Cancel pending WebView permission requests when the activity is destroyed or the request is cancelled.
- Keep camera/microphone use foreground and visible unless a separately reviewed Android foreground-service design is implemented.

The Android template now intercepts WebView camera/microphone permission requests, accepts only the trusted packaged origin or debug loopback origin, rejects unknown resources, shows an in-app disclosure, and then checks/requests the matching Android runtime permission. It grants only the exact requested WebView resources after Android reports permission granted. Pending requests are denied on cancellation or activity destruction. This implementation still requires CI verification and real-device testing before being considered release-ready.

## Store and privacy release gates

Before a generated app is submitted to Google Play or Microsoft Store:

- Publish an accurate privacy policy if personal information is accessed, collected, or transmitted, and link it where the store requires.
- Complete the relevant store privacy/data-safety declarations truthfully.
- Explain data access and sharing in-app before requesting consent where required.
- Provide opt-out/revocation controls and honor OS-level permission changes.
- Document network endpoints, retention, encryption, analytics, crash reporting, and third-party SDK data flows.
- Verify that requested permissions/capabilities are necessary for current, advertised features.
- Review the latest store policies at submission time; policies can change.

Microsoft Store's Windows capability declarations must match the Windows implementation. A future Windows target needs its own platform-specific permission and privacy review; Android manifest permissions cannot be reused as a Windows permission model.

## Current implementation status

- New projects start with no camera or microphone permissions declared.
- `dolphin config capability camera enable|disable` and `dolphin config capability microphone enable|disable` opt those permissions into or out of the generated Android manifest and update `dolphin.config.json`.
- The Android shell mediates WebView camera/microphone requests with trusted-origin checks, disclosure, and Android runtime permission checks.
- One-shot sensor APIs and continuous `watchSensor` subscriptions are implemented for accelerometer, gyroscope, magnetometer, light and proximity sensors; unavailable hardware and sensor timeouts return errors. Streams support explicit stop callbacks and are stopped when the Android activity leaves the foreground.
- Generalized permission revocation handling, privacy policy templates, and real-device verification remain release work. Sensor streams currently stop on backgrounding; applications must subscribe again after returning to the foreground.