#import <React/RCTBridgeModule.h>

// Exposes whether the running build was installed via the sandbox
// receipt path (TestFlight or the App Review environment). App Store
// production installs end the receipt URL in "receipt"; sandbox
// installs end it in "sandboxReceipt".
@interface ReceiptEnvironmentModule : NSObject <RCTBridgeModule>
@end

@implementation ReceiptEnvironmentModule

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (NSDictionary *)constantsToExport {
  NSURL *receiptURL = [NSBundle mainBundle].appStoreReceiptURL;
  BOOL isSandbox = [receiptURL.lastPathComponent isEqualToString:@"sandboxReceipt"];
  return @{ @"isSandboxReceipt": @(isSandbox) };
}

@end
