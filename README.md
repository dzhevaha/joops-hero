# Joops.ai — hero concept

Animated hero section for joops.ai, built 1:1 from the Figma mockups (desktop 1360 / mobile 390).
Plain HTML + CSS + vanilla JS, no build step.

- `index.html` — markup (informer cards use the exact Figma geometry)
- `styles.css` — layout, header unfold, copy and card-content entrances
- `script.js` — orbit engine: rings, dots, informer cards, the counter-clockwise informer and its trail, pointer reaction

Run locally:

```bash
python -m http.server 4178
```

then open http://localhost:4178.
