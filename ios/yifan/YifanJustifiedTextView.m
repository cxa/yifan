#import "YifanJustifiedTextView.h"

#import <CoreText/CoreText.h>

// Custom attributed-string keys so we don't have to lean on
// NSLinkAttributeName and its link-flavoured gesture machinery.
static NSAttributedStringKey const kYifanSegmentTypeKey = @"YifanSegmentType";
static NSAttributedStringKey const kYifanSegmentPayloadKey = @"YifanSegmentPayload";

static NSString *const kSegmentTypeMention = @"mention";
static NSString *const kSegmentTypeTag = @"tag";
static NSString *const kSegmentTypeLink = @"link";

@interface YifanJustifiedTextView () <UIGestureRecognizerDelegate>
@property (nonatomic, strong) UILabel *label;
@property (nonatomic, copy) NSAttributedString *baseAttributedText;
@property (nonatomic, copy) NSAttributedString *renderedAttributedText;
@property (nonatomic, assign) CGFloat lastJustifyWidth;
@property (nonatomic, assign) BOOL isApplyingJustifyKerning;
@end

@implementation YifanJustifiedTextView

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    _fontSize = 15;
    _lineHeight = 24;
    _justify = YES;

    _label = [[UILabel alloc] initWithFrame:self.bounds];
    _label.numberOfLines = 0;
    _label.lineBreakMode = NSLineBreakByWordWrapping;
    _label.backgroundColor = [UIColor clearColor];
    _label.translatesAutoresizingMaskIntoConstraints = NO;
    _label.userInteractionEnabled = YES;
    [self addSubview:_label];
    [NSLayoutConstraint activateConstraints:@[
      [_label.topAnchor constraintEqualToAnchor:self.topAnchor],
      [_label.leadingAnchor constraintEqualToAnchor:self.leadingAnchor],
      [_label.trailingAnchor constraintEqualToAnchor:self.trailingAnchor],
      [_label.bottomAnchor constraintEqualToAnchor:self.bottomAnchor],
    ]];

    UITapGestureRecognizer *tap =
        [[UITapGestureRecognizer alloc] initWithTarget:self
                                                action:@selector(handleTap:)];
    tap.delegate = self;
    tap.cancelsTouchesInView = NO;
    [_label addGestureRecognizer:tap];
  }
  return self;
}

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

  self.baseAttributedText = [attr copy];
  self.renderedAttributedText = attr;
  self.lastJustifyWidth = -1; // force re-kerning on next layout
  self.label.textAlignment =
      self.justify ? NSTextAlignmentJustified : NSTextAlignmentNatural;
  self.label.attributedText = attr;
  [self invalidateIntrinsicContentSize];
  [self setNeedsLayout];
}

// iOS's built-in `.justified` alignment only stretches existing
// whitespace for CJK; pure Chinese/Japanese/Korean lines never reach
// the right edge, and lines mixing narrow ASCII chars end raggedly.
// We take over: measure each line via CTFramesetter, compute the gap
// between its natural width and the target column width, and apply
// `NSKernAttributeName` evenly across the interior characters of that
// line so the glyphs spread out to fill the column. The last line is
// left alone (conventional book typography). A per-line kern cap
// prevents especially short lines from turning into a haiku.
- (void)applyPerLineJustifyKerningIfNeeded {
  if (!self.justify) return;
  if (self.isApplyingJustifyKerning) return;
  NSAttributedString *base = self.baseAttributedText;
  if (base.length == 0) return;
  CGFloat width = self.label.bounds.size.width;
  if (width <= 0) return;
  if (ABS(width - self.lastJustifyWidth) < 0.5) return;

  CFAttributedStringRef cfAttr = (__bridge CFAttributedStringRef)base;
  CTFramesetterRef fs = CTFramesetterCreateWithAttributedString(cfAttr);
  CGPathRef path =
      CGPathCreateWithRect(CGRectMake(0, 0, width, CGFLOAT_MAX), NULL);
  CTFrameRef frame = CTFramesetterCreateFrame(
      fs, CFRangeMake(0, (CFIndex)base.length), path, NULL);
  CFArrayRef lines = CTFrameGetLines(frame);
  CFIndex lineCount = CFArrayGetCount(lines);

  NSMutableAttributedString *mutable = [base mutableCopy];
  CGFloat maxKern = self.fontSize * 0.6;

  for (CFIndex i = 0; i + 1 < lineCount; i++) {
    CTLineRef line = (CTLineRef)CFArrayGetValueAtIndex(lines, i);
    CFRange range = CTLineGetStringRange(line);
    if (range.length < 2) continue;
    CGFloat natural = CTLineGetTypographicBounds(line, NULL, NULL, NULL);
    CGFloat gap = width - natural;
    if (gap < 0.5) continue;
    CGFloat kern = gap / (CGFloat)(range.length - 1);
    if (kern > maxKern) kern = maxKern;
    // NSKernAttributeName sets trailing spacing after each character in
    // the attributed range. Apply to all but the last char of the line
    // so the kern accumulates *between* chars without pushing the final
    // glyph off the right edge.
    NSRange kernRange =
        NSMakeRange((NSUInteger)range.location,
                    (NSUInteger)(range.length - 1));
    [mutable addAttribute:NSKernAttributeName
                    value:@(kern)
                    range:kernRange];
  }

  CFRelease(frame);
  CFRelease(fs);
  CGPathRelease(path);

  self.isApplyingJustifyKerning = YES;
  self.renderedAttributedText = mutable;
  self.label.attributedText = mutable;
  self.lastJustifyWidth = width;
  self.isApplyingJustifyKerning = NO;
}

- (CGSize)intrinsicContentSize {
  CGFloat width = self.bounds.size.width;
  if (width <= 0) return CGSizeMake(UIViewNoIntrinsicMetric, UIViewNoIntrinsicMetric);
  CGSize fitted =
      [self.label sizeThatFits:CGSizeMake(width, CGFLOAT_MAX)];
  return CGSizeMake(UIViewNoIntrinsicMetric, ceil(fitted.height));
}

- (void)layoutSubviews {
  [super layoutSubviews];
  [self applyPerLineJustifyKerningIfNeeded];
  [self reportContentSize];
}

- (void)reportContentSize {
  if (!self.onContentSizeChange) return;
  CGFloat width = self.bounds.size.width;
  if (width <= 0) return;
  CGSize fitted =
      [self.label sizeThatFits:CGSizeMake(width, CGFLOAT_MAX)];
  self.onContentSizeChange(
      @{@"width" : @(width), @"height" : @(ceil(fitted.height))});
}

#pragma mark - Tap handling via CoreText hit-test

- (NSUInteger)characterIndexAtPoint:(CGPoint)point {
  NSAttributedString *attrString = self.renderedAttributedText;
  CGFloat width = self.label.bounds.size.width;
  if (attrString.length == 0 || width <= 0) {
    return NSNotFound;
  }

  CFAttributedStringRef cfAttr = (__bridge CFAttributedStringRef)attrString;
  CTFramesetterRef framesetter =
      CTFramesetterCreateWithAttributedString(cfAttr);
  CGPathRef path = CGPathCreateWithRect(
      CGRectMake(0, 0, width, CGFLOAT_MAX), NULL);
  CTFrameRef frame = CTFramesetterCreateFrame(
      framesetter, CFRangeMake(0, (CFIndex)attrString.length), path, NULL);

  CFArrayRef lines = CTFrameGetLines(frame);
  CFIndex lineCount = CFArrayGetCount(lines);
  NSUInteger result = NSNotFound;
  if (lineCount == 0) {
    CFRelease(frame);
    CFRelease(framesetter);
    CGPathRelease(path);
    return result;
  }

  CGPoint origins[lineCount];
  CTFrameGetLineOrigins(frame, CFRangeMake(0, lineCount), origins);
  CGFloat ascent = 0, descent = 0, leading = 0;
  CTLineGetTypographicBounds((CTLineRef)CFArrayGetValueAtIndex(lines, 0),
                             &ascent, &descent, &leading);
  CGFloat lineHeight = ascent + descent + leading;
  CGFloat firstLineBaseline = origins[0].y;
  // Text block height (topmost baseline to bottom of last line descent):
  CGFloat blockHeight = firstLineBaseline + descent +
                        (origins[0].y - origins[lineCount - 1].y);
  CGFloat labelHeight = self.label.bounds.size.height;
  // UILabel with numberOfLines=0 centres its content block vertically only
  // if the label is taller than the block. In our RN-driven auto-size the
  // label hugs the content, so topOffset is typically 0.
  CGFloat topOffset = MAX(0, (labelHeight - blockHeight) / 2.0);

  for (CFIndex i = 0; i < lineCount; i++) {
    CTLineRef line = (CTLineRef)CFArrayGetValueAtIndex(lines, i);
    CGFloat lineTopInView =
        topOffset + (firstLineBaseline - origins[i].y) - ascent;
    CGFloat lineBottomInView = lineTopInView + lineHeight;
    BOOL lastLine = (i == lineCount - 1);
    BOOL inYRange =
        (point.y >= lineTopInView) && (point.y < lineBottomInView);
    if (!inYRange && !(lastLine && point.y >= lineBottomInView)) continue;

    CGPoint relative = CGPointMake(point.x - origins[i].x, 0);
    CFIndex idx = CTLineGetStringIndexForPosition(line, relative);
    if (idx == kCFNotFound) continue;
    CFRange lineRange = CTLineGetStringRange(line);
    if (idx < lineRange.location) idx = lineRange.location;
    CFIndex maxIdx = lineRange.location + lineRange.length - 1;
    if (idx > maxIdx) idx = maxIdx;
    if (idx >= 0) result = (NSUInteger)idx;
    break;
  }

  CFRelease(frame);
  CFRelease(framesetter);
  CGPathRelease(path);
  return result;
}

- (void)handleTap:(UITapGestureRecognizer *)recognizer {
  if (recognizer.state != UIGestureRecognizerStateEnded) return;
  CGPoint point = [recognizer locationInView:self.label];
  NSAttributedString *storage = self.renderedAttributedText;
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
