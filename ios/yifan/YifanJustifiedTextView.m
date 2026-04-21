#import "YifanJustifiedTextView.h"

// Custom attributed-string keys that carry the segment kind and payload
// without falling back to NSLinkAttributeName. UITextView treats
// NSLinkAttributeName as a semantic link and takes the link-flavoured
// layout path, which — like RN's nested <Text onPress> — fragments the
// attributed run and defeats CJK inter-character justify. Taps are
// resolved manually below.
static NSAttributedStringKey const kYifanSegmentTypeKey = @"YifanSegmentType";
static NSAttributedStringKey const kYifanSegmentPayloadKey = @"YifanSegmentPayload";

static NSString *const kSegmentTypeMention = @"mention";
static NSString *const kSegmentTypeTag = @"tag";
static NSString *const kSegmentTypeLink = @"link";

@interface YifanJustifiedTextView () <UIGestureRecognizerDelegate>
@property (nonatomic, strong) UITextView *textView;
@end

@implementation YifanJustifiedTextView

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    _fontSize = 15;
    _lineHeight = 24;
    _justify = YES;

    _textView = [[UITextView alloc] initWithFrame:self.bounds];
    _textView.editable = NO;
    _textView.selectable = NO;
    _textView.scrollEnabled = NO;
    _textView.backgroundColor = [UIColor clearColor];
    _textView.textContainerInset = UIEdgeInsetsZero;
    _textView.textContainer.lineFragmentPadding = 0;
    _textView.dataDetectorTypes = UIDataDetectorTypeNone;
    _textView.showsVerticalScrollIndicator = NO;
    _textView.showsHorizontalScrollIndicator = NO;
    _textView.autocorrectionType = UITextAutocorrectionTypeNo;
    _textView.spellCheckingType = UITextSpellCheckingTypeNo;
    _textView.translatesAutoresizingMaskIntoConstraints = NO;
    [self addSubview:_textView];
    [NSLayoutConstraint activateConstraints:@[
      [_textView.topAnchor constraintEqualToAnchor:self.topAnchor],
      [_textView.leadingAnchor constraintEqualToAnchor:self.leadingAnchor],
      [_textView.trailingAnchor constraintEqualToAnchor:self.trailingAnchor],
      [_textView.bottomAnchor constraintEqualToAnchor:self.bottomAnchor],
    ]];

    UITapGestureRecognizer *tap =
        [[UITapGestureRecognizer alloc] initWithTarget:self
                                                action:@selector(handleTap:)];
    tap.delegate = self;
    tap.cancelsTouchesInView = NO;
    [self addGestureRecognizer:tap];
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
    [attr addAttribute:NSParagraphStyleAttributeName
                 value:ps
                 range:NSMakeRange(0, attr.length)];
  }

  // UITextView's textAlignment property can override per-range paragraph
  // styles depending on ordering; set it explicitly in addition to the
  // attribute so the justify alignment is applied reliably.
  self.textView.textAlignment =
      self.justify ? NSTextAlignmentJustified : NSTextAlignmentNatural;
  self.textView.attributedText = attr;
  [self invalidateIntrinsicContentSize];
  [self setNeedsLayout];
}

- (CGSize)intrinsicContentSize {
  CGFloat width = self.textView.frame.size.width;
  if (width <= 0) width = self.frame.size.width;
  if (width <= 0) return CGSizeMake(UIViewNoIntrinsicMetric, UIViewNoIntrinsicMetric);
  CGSize fitted = [self.textView sizeThatFits:CGSizeMake(width, CGFLOAT_MAX)];
  return CGSizeMake(UIViewNoIntrinsicMetric, ceil(fitted.height));
}

- (void)layoutSubviews {
  [super layoutSubviews];
  [self reportContentSize];
}

- (void)reportContentSize {
  if (!self.onContentSizeChange) return;
  CGFloat width = self.bounds.size.width;
  if (width <= 0) return;
  CGSize fitted =
      [self.textView sizeThatFits:CGSizeMake(width, CGFLOAT_MAX)];
  self.onContentSizeChange(
      @{@"width" : @(width), @"height" : @(ceil(fitted.height))});
}

#pragma mark - Tap handling

- (void)handleTap:(UITapGestureRecognizer *)recognizer {
  if (recognizer.state != UIGestureRecognizerStateEnded) return;
  CGPoint point = [recognizer locationInView:self.textView];
  NSAttributedString *storage = self.textView.textStorage;
  if (storage.length == 0) {
    if (self.onPressText) self.onPressText(@{});
    return;
  }

  NSLayoutManager *lm = self.textView.layoutManager;
  NSTextContainer *tc = self.textView.textContainer;
  // Use the glyph index so we don't accidentally land on a trailing
  // newline or whitespace mid-layout.
  CGFloat fraction = 0;
  NSUInteger glyphIndex =
      [lm glyphIndexForPoint:point
             inTextContainer:tc
        fractionOfDistanceThroughGlyph:&fraction];
  if (glyphIndex >= [lm numberOfGlyphs]) {
    if (self.onPressText) self.onPressText(@{});
    return;
  }
  NSUInteger charIndex =
      [lm characterIndexForGlyphAtIndex:glyphIndex];
  if (charIndex >= storage.length) {
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
  // Let the tap coexist with whatever list/scroll gesture is above us.
  return YES;
}

@end
