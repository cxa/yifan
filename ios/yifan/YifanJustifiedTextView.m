#import "YifanJustifiedTextView.h"

#import <CoreText/CoreText.h>

// Custom keys so we don't lean on NSLinkAttributeName and its
// link-flavoured gesture machinery.
static NSAttributedStringKey const kYifanSegmentTypeKey = @"YifanSegmentType";
static NSAttributedStringKey const kYifanSegmentPayloadKey = @"YifanSegmentPayload";

static NSString *const kSegmentTypeMention = @"mention";
static NSString *const kSegmentTypeTag = @"tag";
static NSString *const kSegmentTypeLink = @"link";

@interface YifanJustifiedTextView () <UIGestureRecognizerDelegate>
@property (nonatomic, copy) NSAttributedString *attributedText;
@end

@implementation YifanJustifiedTextView

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    _fontSize = 15;
    _lineHeight = 24;
    _justify = YES;
    self.backgroundColor = [UIColor clearColor];
    self.opaque = NO;
    self.contentMode = UIViewContentModeRedraw;
    self.userInteractionEnabled = YES;

    UITapGestureRecognizer *tap =
        [[UITapGestureRecognizer alloc] initWithTarget:self
                                                action:@selector(handleTap:)];
    tap.delegate = self;
    tap.cancelsTouchesInView = NO;
    [self addGestureRecognizer:tap];
  }
  return self;
}

#pragma mark - Prop setters

- (void)setSegments:(NSArray<NSDictionary *> *)segments {
  _segments = [segments copy];
  [self rebuildAttributedText];
}

- (void)setTextColor:(UIColor *)textColor {
  _textColor = textColor;
  [self rebuildAttributedText];
}

- (void)setAccentColor:(UIColor *)accentColor {
  _accentColor = accentColor;
  [self rebuildAttributedText];
}

- (void)setTagActiveColor:(UIColor *)color {
  _tagActiveColor = color;
  [self rebuildAttributedText];
}

- (void)setTagActiveBackgroundColor:(UIColor *)color {
  _tagActiveBackgroundColor = color;
  [self rebuildAttributedText];
}

- (void)setTagInactiveBackgroundColor:(UIColor *)color {
  _tagInactiveBackgroundColor = color;
  [self rebuildAttributedText];
}

- (void)setFontFamily:(NSString *)fontFamily {
  _fontFamily = [fontFamily copy];
  [self rebuildAttributedText];
}

- (void)setFontSize:(CGFloat)fontSize {
  _fontSize = fontSize > 0 ? fontSize : 15;
  [self rebuildAttributedText];
}

- (void)setLineHeight:(CGFloat)lineHeight {
  _lineHeight = lineHeight > 0 ? lineHeight : 24;
  [self rebuildAttributedText];
}

- (void)setJustify:(BOOL)justify {
  _justify = justify;
  [self rebuildAttributedText];
}

- (void)setActiveTag:(NSString *)activeTag {
  _activeTag = [activeTag copy];
  [self rebuildAttributedText];
}

#pragma mark - Attributed-string build

- (UIFont *)resolveFont {
  CGFloat size = self.fontSize > 0 ? self.fontSize : 15;
  if (self.fontFamily.length > 0) {
    UIFont *custom = [UIFont fontWithName:self.fontFamily size:size];
    if (custom) return custom;
  }
  return [UIFont systemFontOfSize:size];
}

- (void)rebuildAttributedText {
  NSArray *segments = self.segments ?: @[];
  NSMutableAttributedString *attr = [[NSMutableAttributedString alloc] init];
  UIFont *font = [self resolveFont];
  UIColor *baseColor = self.textColor ?: [UIColor blackColor];
  UIColor *accentColor = self.accentColor ?: [UIColor systemBlueColor];

  for (NSDictionary *segment in segments) {
    if (![segment isKindOfClass:[NSDictionary class]]) continue;
    NSString *type = segment[@"type"] ?: @"text";
    NSString *text = segment[@"text"] ?: @"";
    if (text.length == 0) continue;

    NSMutableDictionary<NSAttributedStringKey, id> *attrs = [NSMutableDictionary dictionary];
    attrs[NSFontAttributeName] = font;
    attrs[NSForegroundColorAttributeName] = baseColor;

    if ([type isEqualToString:@"mention"]) {
      NSString *screenName = segment[@"screenName"] ?: @"";
      attrs[NSForegroundColorAttributeName] = accentColor;
      attrs[kYifanSegmentTypeKey] = kSegmentTypeMention;
      attrs[kYifanSegmentPayloadKey] = screenName;
    } else if ([type isEqualToString:@"tag"]) {
      NSString *tag = segment[@"tag"] ?: @"";
      BOOL isActive = self.activeTag.length > 0 &&
                      [self.activeTag.lowercaseString
                          isEqualToString:tag.lowercaseString];
      UIColor *fg = isActive ? (self.tagActiveColor ?: [UIColor whiteColor]) : accentColor;
      UIColor *bg = isActive ? self.tagActiveBackgroundColor
                             : self.tagInactiveBackgroundColor;
      attrs[NSForegroundColorAttributeName] = fg;
      if (bg) attrs[NSBackgroundColorAttributeName] = bg;
      attrs[kYifanSegmentTypeKey] = kSegmentTypeTag;
      attrs[kYifanSegmentPayloadKey] = tag;
    } else if ([type isEqualToString:@"link"]) {
      NSString *href = segment[@"href"] ?: @"";
      attrs[NSForegroundColorAttributeName] = accentColor;
      attrs[NSUnderlineStyleAttributeName] = @(NSUnderlineStyleSingle);
      attrs[kYifanSegmentTypeKey] = kSegmentTypeLink;
      attrs[kYifanSegmentPayloadKey] = href;
    }

    [attr appendAttributedString:[[NSAttributedString alloc]
                                     initWithString:text
                                         attributes:attrs]];
  }

  if (attr.length > 0) {
    NSMutableParagraphStyle *ps = [[NSMutableParagraphStyle alloc] init];
    ps.alignment =
        self.justify ? NSTextAlignmentJustified : NSTextAlignmentNatural;
    CGFloat lh = self.lineHeight > 0 ? self.lineHeight : self.fontSize * 1.4;
    ps.minimumLineHeight = lh;
    ps.maximumLineHeight = lh;
    ps.lineBreakMode = NSLineBreakByWordWrapping;
    [attr addAttribute:NSParagraphStyleAttributeName
                 value:ps
                 range:NSMakeRange(0, attr.length)];
  }

  self.attributedText = attr;
  [self invalidateIntrinsicContentSize];
  [self setNeedsDisplay];
  [self setNeedsLayout];
}

#pragma mark - Drawing

- (void)drawRect:(CGRect)rect {
  NSAttributedString *attr = self.attributedText;
  if (attr.length == 0) return;
  CGFloat W = self.bounds.size.width;
  CGFloat H = self.bounds.size.height;
  if (W <= 0 || H <= 0) return;

  CGContextRef ctx = UIGraphicsGetCurrentContext();
  CGContextSaveGState(ctx);
  CGContextTranslateCTM(ctx, 0, H);
  CGContextScaleCTM(ctx, 1, -1);
  CGContextSetTextMatrix(ctx, CGAffineTransformIdentity);

  CTFramesetterRef fs = CTFramesetterCreateWithAttributedString(
      (__bridge CFAttributedStringRef)attr);
  CGPathRef path = CGPathCreateWithRect(CGRectMake(0, 0, W, H), NULL);
  CTFrameRef frame = CTFramesetterCreateFrame(
      fs, CFRangeMake(0, 0), path, NULL);

  CTFrameDraw(frame, ctx);

  CFRelease(frame);
  CFRelease(fs);
  CGPathRelease(path);
  CGContextRestoreGState(ctx);
}

#pragma mark - Sizing

- (CGSize)measuredSizeForWidth:(CGFloat)width {
  NSAttributedString *attr = self.attributedText;
  if (attr.length == 0 || width <= 0) return CGSizeZero;
  CTFramesetterRef fs = CTFramesetterCreateWithAttributedString(
      (__bridge CFAttributedStringRef)attr);
  CGSize fit = CTFramesetterSuggestFrameSizeWithConstraints(
      fs, CFRangeMake(0, 0), NULL,
      CGSizeMake(width, CGFLOAT_MAX), NULL);
  CFRelease(fs);
  return CGSizeMake(width, ceil(fit.height));
}

- (CGSize)intrinsicContentSize {
  CGFloat width = self.bounds.size.width;
  if (width <= 0) return CGSizeMake(UIViewNoIntrinsicMetric, UIViewNoIntrinsicMetric);
  CGSize s = [self measuredSizeForWidth:width];
  return CGSizeMake(UIViewNoIntrinsicMetric, s.height);
}

- (void)setBounds:(CGRect)bounds {
  CGRect old = self.bounds;
  [super setBounds:bounds];
  if (!CGRectEqualToRect(old, bounds)) {
    [self setNeedsDisplay];
  }
}

- (void)layoutSubviews {
  [super layoutSubviews];
  [self reportContentSize];
}

- (void)reportContentSize {
  if (!self.onContentSizeChange) return;
  CGFloat width = self.bounds.size.width;
  if (width <= 0) return;
  CGSize s = [self measuredSizeForWidth:width];
  self.onContentSizeChange(@{@"width" : @(width), @"height" : @(s.height)});
}

#pragma mark - Tap handling via CoreText hit-test

- (NSUInteger)characterIndexAtPoint:(CGPoint)point {
  NSAttributedString *attr = self.attributedText;
  if (attr.length == 0) return NSNotFound;
  CGFloat W = self.bounds.size.width;
  CGFloat H = self.bounds.size.height;
  if (W <= 0 || H <= 0) return NSNotFound;

  CGFloat ctY = H - point.y;

  CTFramesetterRef fs = CTFramesetterCreateWithAttributedString(
      (__bridge CFAttributedStringRef)attr);
  CGPathRef path = CGPathCreateWithRect(CGRectMake(0, 0, W, H), NULL);
  CTFrameRef frame = CTFramesetterCreateFrame(
      fs, CFRangeMake(0, 0), path, NULL);
  CFArrayRef lines = CTFrameGetLines(frame);
  CFIndex lineCount = CFArrayGetCount(lines);
  NSUInteger result = NSNotFound;

  if (lineCount > 0) {
    CGPoint origins[lineCount];
    CTFrameGetLineOrigins(frame, CFRangeMake(0, 0), origins);

    for (CFIndex i = 0; i < lineCount; i++) {
      CTLineRef line = (CTLineRef)CFArrayGetValueAtIndex(lines, i);
      CGFloat ascent = 0, descent = 0;
      CTLineGetTypographicBounds(line, &ascent, &descent, NULL);
      CGFloat lineTop = origins[i].y + ascent;
      CGFloat lineBottom = origins[i].y - descent;
      BOOL isLast = (i == lineCount - 1);
      BOOL inY = (ctY >= lineBottom) && (ctY <= lineTop);
      if (!inY) {
        BOOL aboveFirst = (i == 0 && ctY > lineTop);
        BOOL belowLast = (isLast && ctY < lineBottom);
        if (!(aboveFirst || belowLast)) continue;
      }

      CGPoint relative = CGPointMake(point.x - origins[i].x, 0);
      CFIndex idx = CTLineGetStringIndexForPosition(line, relative);
      if (idx != kCFNotFound) {
        CFRange range = CTLineGetStringRange(line);
        if (idx < range.location) idx = range.location;
        CFIndex maxIdx = range.location + range.length - 1;
        if (idx > maxIdx) idx = maxIdx;
        if (idx >= 0) result = (NSUInteger)idx;
      }
      break;
    }
  }

  CFRelease(frame);
  CFRelease(fs);
  CGPathRelease(path);
  return result;
}

- (void)handleTap:(UITapGestureRecognizer *)recognizer {
  if (recognizer.state != UIGestureRecognizerStateEnded) return;
  CGPoint point = [recognizer locationInView:self];
  NSAttributedString *storage = self.attributedText;
  if (storage.length == 0) {
    if (self.onPressText) self.onPressText(@{});
    return;
  }
  NSUInteger charIndex = [self characterIndexAtPoint:point];
  if (charIndex == NSNotFound || charIndex >= storage.length) {
    if (self.onPressText) self.onPressText(@{});
    return;
  }
  NSString *type = [storage attribute:kYifanSegmentTypeKey
                              atIndex:charIndex
                       effectiveRange:NULL];
  if (!type) {
    if (self.onPressText) self.onPressText(@{});
    return;
  }
  id payload = [storage attribute:kYifanSegmentPayloadKey
                          atIndex:charIndex
                   effectiveRange:NULL];
  NSString *payloadString = [payload isKindOfClass:[NSString class]]
                                ? (NSString *)payload
                                : @"";
  if ([type isEqualToString:kSegmentTypeMention] && self.onPressMention) {
    self.onPressMention(@{@"screenName" : payloadString});
  } else if ([type isEqualToString:kSegmentTypeTag] && self.onPressTag) {
    self.onPressTag(@{@"tag" : payloadString});
  } else if ([type isEqualToString:kSegmentTypeLink] && self.onPressLink) {
    self.onPressLink(@{@"href" : payloadString});
  } else if (self.onPressText) {
    self.onPressText(@{});
  }
}

#pragma mark - UIGestureRecognizerDelegate

- (BOOL)gestureRecognizer:(UIGestureRecognizer *)gestureRecognizer
    shouldRecognizeSimultaneouslyWithGestureRecognizer:
        (UIGestureRecognizer *)otherGestureRecognizer {
  return YES;
}

@end
