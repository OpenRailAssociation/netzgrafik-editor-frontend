# SVG rendering

We leverage [SVG] and [d3] for drawing.

## Compatibility with image viewers and editors

When a network graph is exported, the editor main view's SVG is copied over to
a file, with minor modifications. Unfortunately, vector graphics viewers and
editors don't always have very good support for modern SVG features. For this
reason, we need to use a subset of modern SVG compatible with Web browsers and
image software alike.

We're routinely testing exported SVG files with [Inkscape].

### `rx`, `ry` and `r` CSS properties

Some software doesn't support these CSS properties (e.g.
[Inkscape][inkscape#5233]), and only supports the matching SVG element
attributes. As a result, the CSS properties should be avoided.

## Export modifications

When a network graph is exported, some minor modifications are applied.

### Style inlining

Each SVG element's computed style gets inlined into a `style` attribute. Only
allow-listed CSS properties in `essentialProps` are retained.

### Font inlining

Some software doesn't support loading remote fonts (e.g. Inkscape), and only
supports local and `data:` URI fonts. On export, all fonts are downloaded and
inlined in the SVG image as a base64-encoded `data:` URI.

### Element pruning

Some interactive elements clubber exported files. They make it more difficult
to edit exported files: these ghost elements add noise and get in the way.
These elements are marked with the `StaticDomTags.REMOVE_ON_EXPORT` CSS class
and are removed on export.

[SVG]: https://developer.mozilla.org/en-US/docs/Web/SVG
[d3]: https://d3js.org/
[Inkscape]: https://inkscape.org/
[inkscape#5233]: https://gitlab.com/inkscape/inkscape/-/work_items/5233
