import { NativeModules, Platform } from 'react-native';

// Review mode toggles the in-app report UI required by Guideline 1.2:
// ON for Apple App Review, OFF for every shipped user.
//
// Detection uses the iOS App Store receipt path, the only deterministic
// signal Apple gives us:
//   "sandboxReceipt" → TestFlight or App Review
//   "receipt"        → real App Store install, dev build, enterprise
//
// Apple has used this naming since iOS 7. Production users never see a
// sandbox receipt, and reviewers never see a production receipt — so a
// single synchronous constant is enough.
export const IN_REVIEW_MODE: boolean = Platform.OS === 'ios'
  ? Boolean(
      (NativeModules.ReceiptEnvironmentModule as
        | { isSandboxReceipt?: boolean }
        | undefined)?.isSandboxReceipt,
    )
  : false;
