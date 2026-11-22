# Rhumb

Rhumb is a free Ghost theme for writers. One column, set with care: a
65-character measure, a fluid type scale, and proper treatment of every
block the Ghost editor offers. It ships no JavaScript and no font files.

Made by [Aftertype](https://aftertype.studio). More about the theme:
https://aftertype.studio/themes/rhumb

## Requirements

Ghost 6.0 or newer.

## Install

1. Download `rhumb.zip` from the latest release.
2. In Ghost Admin go to Settings > Design & branding > Change theme >
   Upload theme, and choose the zip.
3. Activate it.

## What you can change

Everything is set in Ghost Admin under Settings > Design & branding.

**Ghost's own settings**

- Accent colour. Used for link underlines and buttons. Text on a button
  turns black or white by itself, so any colour stays readable.
- Publication logo. Shown as a small mark next to the site title, not in
  place of it. A square or near-square mark works best.
- Heading font and body font (Typography). Without a choice Rhumb uses the
  serif already on the reader's device: Charter on Apple devices, Sitka or
  Cambria on Windows, the system serif elsewhere. Fonts picked here are
  loaded by Ghost from Bunny Fonts, an external service.
- Navigation and secondary navigation. The secondary one appears in the
  footer.

**Rhumb's settings**

| Setting | Default | What it does |
|---|---|---|
| Color scheme | Auto | Auto follows the reader's device. Light and Dark force one. |
| Show excerpts | Off | Adds the excerpt under each title in post lists. |
| Show theme credit | On | Shows "Rhumb theme by Aftertype" in the footer. |

If Rhumb is useful to you, leaving the credit on is the one thing we ask.

## Writing

All editor cards are supported, including wide and full-width images.

Ghost has no footnote button. To add footnotes, insert a Markdown card and
use the usual syntax:

```markdown
A claim that needs a source.[^1]

[^1]: The source.
```

Tables work the same way, in a Markdown card. Columns aligned right
(`---:`) are treated as figures and never wrap.

## Members

Portal, the subscribe form on the home page, members-only and paid posts,
native comments and native search all work without setup beyond switching
them on in Ghost.

## Languages

English, Dutch, French, German and Spanish. Set the language under
Settings > General > Publication language (`en`, `nl`, `fr`, `de`, `es`).

To add a language, copy `locales/en.json` to `locales/<code>.json` and
translate the values on the right. Restart Ghost afterwards.

## Changing the theme

There is no build step. The styles are two plain CSS files:

- `assets/css/screen.css`: colours, type scale and spacing (the custom
  properties at the top), layout, header, post list, footer.
- `assets/css/content.css`: the post itself and the editor cards. Loaded
  on posts and pages only.

Edit, save, reload. To check the theme against Ghost's rules and build a
zip:

```bash
npm install
npm test
npm run zip
```

Rhumb relies on current CSS (`light-dark()`, `@property`, the `rlh` unit).
It needs Chrome or Edge 123, Safari 17.5 or Firefox 128, or newer. Older
browsers get readable black-on-white text without the layout refinements.

## License

MIT, see [LICENSE](LICENSE). Questions: support@aftertype.studio
