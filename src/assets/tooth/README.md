# Tooth game sprites

Generated with the built-in ImageGen tool on 2026-09-10. `sprites.png` is the original 1536 × 1024 RGBA output, with its alpha preserved. No external asset service or runtime dependency is required.

The image is imported by the shared `src/art/sprites.ts` registry. `GameSprite.vue` renders its registered regions directly, without global SVG symbols. Vite fingerprints the asset and resolves the deployment base path. See `src/art/README.md` for reuse and extension instructions.

| Sprite name | Artwork | SVG viewBox |
| --- | --- | --- |
| kid | Brushing adventurer | 70 0 400 512 |
| bug-coral | Coral cavity bug | 580 35 440 450 |
| bug-purple | Purple cavity bug | 1110 15 395 475 |
| tooth | Clean tooth mascot | 40 542 475 450 |
| toothbrush | Toothbrush | 655 516 240 500 |
| kid-cheer | Celebrating adventurer | 1080 512 404 512 |

## Generation prompt

Use case: stylized-concept
Asset type: production transparent PNG sprite atlas for a preschool tooth-brushing maze game.
Primary request: Create ONE coherent premium game sprite sheet, 1536 x 1024 landscape, exactly three equal columns and two equal rows (six 512 x 512 cells), with a truly transparent alpha background, absolutely no background color, no checkerboard drawn in the image, no cell borders, no text, no labels.
Style: adorable storybook game illustrations, soft matte gouache colors with subtle dimensional shading, rounded sculpted shapes, fine warm dark colored outlines, expressive clean faces, simple strong silhouettes legible at 56px. Polished professional children's mobile game assets, not flat geometric pictograms, not pixel art, not photorealistic or shiny plastic 3D.
Each sprite must fit entirely within its own cell with about 40px padding, centered, no overlaps between cells, no scenery, no ground plane or drop shadows, no detached decorations except the tooth sparkles described below.
Top left: a charming child tooth-brushing adventurer full body, front three-quarter pose facing slightly right, oversized head about half the height, fluffy dark brown hair, rosy round cheeks, smiling, mint green overalls over a cream T-shirt, coral red shoes, holding a small coral toothbrush upright in one hand, other hand lifted ready to explore. Both legs visible. Cheerful and gender-neutral. Warm peach skin. Child silhouette fills about 410px height.
Top middle: a mischievous coral-orange cavity bug, round squishy bean body with two short antennae and tiny mitten-like feet/arms, slightly tilted playful eyebrows, wide cream eyes with dark pupils, open grin with one little rounded tooth, small peach spots. Cute antagonist, not scary, no weapons, no slime. Body fills about 380px in width/height.
Top right: a different mischievous lavender-purple cavity bug, plump pear-shaped body with two small curved antennae and tiny feet/arms, amused half-lidded cream eyes, cheeky grin, lilac spots and rose cheeks. Cute antagonist, not scary. Distinct silhouette from orange bug.
Bottom left: happy pearly white molar tooth mascot, two rounded roots, softly rounded crown, pale mint edge shading, little dark smiling eyes, pink cheeks, happy open mouth, tiny rounded arms, two small golden four-point sparkles beside the crown within its cell. Reads unmistakably as a clean tooth.
Bottom middle: a beautiful standalone child's coral-pink toothbrush, upright with a slight jaunty tilt to the right, thick rounded handle, cream and mint bristles, a small curved dollop of mint toothpaste on its head. No face. Large enough to use alone as an icon. Entire object visible, around 400px high.
Bottom right: same child as top left, same outfit, face, hair and toothbrush, celebrating with eyes closed into happy crescents, a wide smile, toothbrush raised triumphantly, tiny joyful hop, full body. This is a victory expression variant of the very same character.
Keep visual scale, outlining and soft upper-left lighting coherent across all six sprites. True transparent alpha around all sprites, no white square background, no checkerboard.

