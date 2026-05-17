#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>
#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

@interface SharedImageModule : NSObject <RCTBridgeModule>
@end

static NSString *YFSharedDataPrefixHex(NSData *data, NSUInteger maxLength) {
  if (data.length == 0) {
    return @"";
  }
  const unsigned char *bytes = data.bytes;
  NSUInteger length = MIN(data.length, maxLength);
  NSMutableArray<NSString *> *parts = [NSMutableArray arrayWithCapacity:length];
  for (NSUInteger i = 0; i < length; i++) {
    [parts addObject:[NSString stringWithFormat:@"%02X", bytes[i]]];
  }
  return [parts componentsJoinedByString:@" "];
}

@implementation SharedImageModule

RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(sharedContainerPath:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *containerURL = [[NSFileManager defaultManager]
    containerURLForSecurityApplicationGroupIdentifier:@"group.im.cxa.fanatter"];
  resolve(containerURL ? containerURL.path : [NSNull null]);
}

RCT_EXPORT_METHOD(shareStatusCardImage:(NSString *)fileUrl
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *url = [fileUrl hasPrefix:@"/"]
    ? [NSURL fileURLWithPath:fileUrl]
    : [NSURL URLWithString:fileUrl];
  if (!url) {
    reject(@"INVALID_URL", @"Invalid status card image URL", nil);
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    UIViewController *controller = RCTPresentedViewController();
    if (!controller) {
      reject(@"NO_VIEW_CONTROLLER", @"Unable to present share sheet", nil);
      return;
    }

    UIActivityViewController *shareController =
      [[UIActivityViewController alloc] initWithActivityItems:@[url]
                                        applicationActivities:nil];

    __block BOOL didSettle = NO;
    void (^settle)(BOOL, NSString *, NSError *) =
      ^(BOOL completed, NSString *activityType, NSError *activityError) {
        if (didSettle) {
          return;
        }
        didSettle = YES;

        if (activityError) {
          reject(@"SHARE_FAILED", activityError.localizedDescription, activityError);
          return;
        }

        resolve(@{
          @"action": completed ? @"sharedAction" : @"dismissedAction",
          @"activityType": activityType ?: (id)[NSNull null],
        });
      };

    shareController.completionWithItemsHandler =
      ^(UIActivityType activityType, BOOL completed, NSArray *returnedItems, NSError *activityError) {
        settle(completed, activityType, activityError);
      };

    UIPopoverPresentationController *popover = shareController.popoverPresentationController;
    if (popover) {
      popover.sourceView = controller.view;
      popover.sourceRect = CGRectMake(
        CGRectGetMidX(controller.view.bounds),
        CGRectGetMaxY(controller.view.bounds),
        1,
        1
      );
      popover.permittedArrowDirections = 0;
    }

    [controller presentViewController:shareController animated:YES completion:nil];
  });
}

// Read a specific file by name and delete it.
RCT_EXPORT_METHOD(readAndClear:(NSString *)fileName
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *containerURL = [[NSFileManager defaultManager]
    containerURLForSecurityApplicationGroupIdentifier:@"group.im.cxa.fanatter"];
  if (!containerURL) {
    reject(@"NO_CONTAINER", @"App Group container unavailable", nil);
    return;
  }

  NSURL *fileURL = [containerURL URLByAppendingPathComponent:fileName];
  NSData *data = [NSData dataWithContentsOfURL:fileURL];
  if (!data) {
    reject(@"NO_FILE", @"No shared image found", nil);
    return;
  }

  [[NSFileManager defaultManager] removeItemAtURL:fileURL error:nil];
  resolve([data base64EncodedStringWithOptions:0]);
}

// Find the newest pending share-image-*.{jpg,gif} in the App Group container,
// read it as base64, delete ALL pending files (including stale ones), and return
// { base64, mimeType, fileName, fileUrl }.
// Returns nil (resolves with NSNull) if no pending image exists.
RCT_EXPORT_METHOD(readAndClearPending:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *containerURL = [[NSFileManager defaultManager]
    containerURLForSecurityApplicationGroupIdentifier:@"group.im.cxa.fanatter"];
  if (!containerURL) {
    resolve([NSNull null]);
    return;
  }

  NSArray *contents = [[NSFileManager defaultManager]
    contentsOfDirectoryAtURL:containerURL
    includingPropertiesForKeys:nil
    options:NSDirectoryEnumerationSkipsHiddenFiles
    error:nil];

  // Find all share-image-*.{jpg,gif} files
  NSMutableArray *shareFiles = [NSMutableArray array];
  for (NSURL *url in contents) {
    NSString *name = url.lastPathComponent;
    if (![name hasPrefix:@"share-image-"]) continue;
    NSString *ext = url.pathExtension.lowercaseString;
    if ([ext isEqualToString:@"jpg"] || [ext isEqualToString:@"gif"]) {
      [shareFiles addObject:url];
    }
  }

  if (shareFiles.count == 0) {
    resolve([NSNull null]);
    return;
  }

  // Sort by name descending; pick the NEWEST file (highest timestamp).
  [shareFiles sortUsingComparator:^NSComparisonResult(NSURL *a, NSURL *b) {
    return [b.lastPathComponent compare:a.lastPathComponent];
  }];

  NSURL *fileURL = shareFiles.firstObject;
  NSData *data = [NSData dataWithContentsOfURL:fileURL];
  NSString *markerName = [NSString stringWithFormat:@"%@.livephoto-fallback",
    [fileURL.lastPathComponent stringByDeletingPathExtension]];
  NSURL *markerURL = [containerURL URLByAppendingPathComponent:markerName];
  BOOL livePhotoStaticFallback =
    [[NSFileManager defaultManager] fileExistsAtPath:markerURL.path];

  // Delete ALL share-image files (the one we read + any stale ones)
  for (NSURL *url in shareFiles) {
    [[NSFileManager defaultManager] removeItemAtURL:url error:nil];
  }
  for (NSURL *url in contents) {
    if ([url.pathExtension isEqualToString:@"livephoto-fallback"]) {
      [[NSFileManager defaultManager] removeItemAtURL:url error:nil];
    }
  }

  if (!data) {
    resolve([NSNull null]);
    return;
  }

  NSString *ext = fileURL.pathExtension.lowercaseString;
  NSString *mimeType = [ext isEqualToString:@"gif"] ? @"image/gif" : @"image/jpeg";
  NSString *fileName = [ext isEqualToString:@"gif"] ? @"shared.gif" : @"shared.jpg";

  NSLog(@"[SharedImage] file=%@ ext=%@ mime=%@ bytes=%lu fallback=%@ magic=%@",
        fileURL.lastPathComponent,
        ext,
        mimeType,
        (unsigned long)data.length,
        livePhotoStaticFallback ? @"true" : @"false",
        YFSharedDataPrefixHex(data, 12));

  // Write to a temp file for stable file:// URI display in Image component.
  NSString *tempName = [NSString stringWithFormat:@"shared-latest.%@", ext];
  NSURL *tempURL = [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:tempName]];
  [[NSFileManager defaultManager] removeItemAtURL:tempURL error:nil];
  [data writeToURL:tempURL atomically:YES];

  NSMutableDictionary *result = [@{
    @"base64": [data base64EncodedStringWithOptions:0],
    @"mimeType": mimeType,
    @"fileName": fileName,
    @"fileUrl": tempURL.absoluteString,
  } mutableCopy];
  if (livePhotoStaticFallback) {
    result[@"livePhotoStaticFallback"] = @YES;
  }
  resolve(result);
}

// Find the oldest pending share-text-*.txt in the App Group container,
// read it as a string, delete it, and return the text.
// Returns nil (resolves with NSNull) if no pending text exists.
RCT_EXPORT_METHOD(readAndClearPendingText:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *containerURL = [[NSFileManager defaultManager]
    containerURLForSecurityApplicationGroupIdentifier:@"group.im.cxa.fanatter"];
  if (!containerURL) {
    resolve([NSNull null]);
    return;
  }

  NSArray *contents = [[NSFileManager defaultManager]
    contentsOfDirectoryAtURL:containerURL
    includingPropertiesForKeys:@[NSURLCreationDateKey]
    options:NSDirectoryEnumerationSkipsHiddenFiles
    error:nil];

  NSArray *shareFiles = [contents filteredArrayUsingPredicate:
    [NSPredicate predicateWithBlock:^BOOL(NSURL *url, NSDictionary *bindings) {
      return [url.lastPathComponent hasPrefix:@"share-text-"] &&
             [url.pathExtension isEqualToString:@"txt"];
    }]];

  if (shareFiles.count == 0) {
    resolve([NSNull null]);
    return;
  }

  NSArray *sorted = [shareFiles sortedArrayUsingComparator:^NSComparisonResult(NSURL *a, NSURL *b) {
    return [a.lastPathComponent compare:b.lastPathComponent];
  }];

  NSURL *fileURL = sorted.firstObject;
  NSString *text = [NSString stringWithContentsOfURL:fileURL encoding:NSUTF8StringEncoding error:nil];
  [[NSFileManager defaultManager] removeItemAtURL:fileURL error:nil];

  if (!text || text.length == 0) {
    resolve([NSNull null]);
    return;
  }

  resolve(text);
}

RCT_EXPORT_METHOD(readDebugLog:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *containerURL = [[NSFileManager defaultManager]
    containerURLForSecurityApplicationGroupIdentifier:@"group.im.cxa.fanatter"];
  if (!containerURL) {
    resolve([NSNull null]);
    return;
  }

  NSURL *fileURL = [containerURL URLByAppendingPathComponent:@"share-debug.txt"];
  NSString *text = [NSString stringWithContentsOfURL:fileURL encoding:NSUTF8StringEncoding error:nil];
  [[NSFileManager defaultManager] removeItemAtURL:fileURL error:nil];
  resolve(text.length > 0 ? text : [NSNull null]);
}

@end
