import Foundation

#if canImport(Sentry)
    import Sentry
#endif

func reportNativeError(_ error: Error, context: String) {
    #if DEBUG
        print("\(context): \(error.localizedDescription)")
    #else
        #if canImport(Sentry)
            SentrySDK.capture(error: error)
        #else
            NSLog("%@: %@", context, error.localizedDescription)
        #endif
    #endif
}
