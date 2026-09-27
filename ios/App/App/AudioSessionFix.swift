import Foundation
import Capacitor
import AVFoundation

/* @capacitor-community/native-audio deactivates the shared AVAudioSession
   once at launch (Plugin.swift's load()) and never explicitly reactivates
   it anywhere — every sound since then has relied on iOS silently
   auto-reactivating it, which races unpredictably against the "On your
   marks"/"Set" speech's own session use and explains the flaky loud/quiet
   behavior on real devices. This plugin gives JS a way to force the
   session back to a known-good, fully active state on demand, right
   before the sound that actually matters plays. */
@objc(AudioSessionFix)
public class AudioSessionFix: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AudioSessionFix"
    public let jsName = "AudioSessionFix"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "reactivate", returnType: CAPPluginReturnPromise)
    ]

    @objc func reactivate(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true, options: [])
            call.resolve()
        } catch {
            call.reject("Failed to reactivate audio session")
        }
    }
}
