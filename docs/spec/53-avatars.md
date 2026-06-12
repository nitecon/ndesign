## Avatars

> **Rules**
> - The class is `.avatar` — NOT `.nd-avatar`. The `nd-` prefix is absent by design.
> - Use for user initials or profile images beside names in lists, comment threads, and nav account menus.
> - Initials MUST be 1–2 uppercase characters — longer strings overflow the small variants.
> - An `<img>` inside `.avatar` MUST have an `alt` attribute (user name, or `""` if purely decorative alongside visible name).
> - Override `--nd-accent` per-avatar via inline style for user-specific colors.

Circular badges showing user initials or a profile image. The class is `.avatar` (NOT `.nd-avatar`) — kept short because avatars appear inline in dense markup such as user lists, comment threads, and presence indicators.

### When to use

- Beside a user's name in a list, comment, or activity feed.
- In a top nav as the account-switcher trigger.

### Minimal example

```html
<span class="avatar">WH</span>

<span class="avatar avatar-lg">
  <img src="/img/alice.jpg" alt="Alice">
</span>
```

### Markup and classes

| Class | Effect |
|---|---|
| `.avatar` | 2rem circle, accent fill, accent-text color, semibold xs font; `<img>` children fill the circle via `object-fit: cover` |
| `.avatar-sm` | 1.5rem |
| `.avatar-lg` | 4rem |
| `.avatar-xl` | 6rem |

The base `.avatar` is `display: inline-flex` and clips overflow, so an `<img>` child fills it without leaking past the rounded corner.

### Pitfalls

- The class is unprefixed (`.avatar`, not `.nd-avatar`). Do NOT add the `nd-` prefix or the styles will not apply.
- Initials should be uppercase and 1–2 characters. Longer strings overflow the small variants.
- An `<img>` inside `.avatar` MUST have an `alt` attribute (use the user's name). Empty `alt=""` is acceptable only when the avatar is purely decorative and the user's name is rendered adjacent.
- The accent fill is the default background when there is no image. Override `--nd-accent` per-avatar via inline style if you need user-specific colors.

### See also

- [Badges](#badges), [Skeletons](#skeletons)
- Source: `scss/_avatars.scss`
