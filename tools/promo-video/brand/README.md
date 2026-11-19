# Provider marks

`openai.svg` and `deepseek.svg` are the bare 24×24 single-path silhouettes
from [Simple Icons](https://github.com/simple-icons/simple-icons) v15.0.0
(CC0-1.0), copied from the app's `public/logos/ai/` so the video draws the
same marks the product does. `storyboard.html` reads the `<path d>` out of
each at load time and paints it in `currentColor`.

The Claude sunburst and the "custom provider" sliders are drawn inline in
`storyboard.html`, as in the app's `BrandLogo.tsx`. `deepseek-LICENSE.txt`
travels with the DeepSeek file as the app ships it.
