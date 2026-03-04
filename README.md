# labelWise

`labelWise` is an open-source web app to annotate images with bounding boxes and export/import annotations in CSV format.

## Demo
- Live preview: [https://label-wise-ashen.vercel.app/](https://label-wise-ashen.vercel.app/)
- Local preview: [http://localhost:5173](http://localhost:5173)

## Features
- Multi-image upload.
- Bounding-box annotation on canvas.
- Move, resize, copy/paste annotations.
- Multi-select annotations (`Ctrl/Cmd + click`).
- Grid guide overlay for easier alignment.
- CSV export with this schema:
  - `label_name,bbox_x,bbox_y,bbox_width,bbox_height,image_name,image_width,image_height`
- CSV import mapped by `image_name`.
- CSV table view for direct row editing.
- Toast notifications for key user actions.

## Tech Stack
- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- shadcn/ui patterns
- Sileo (toasts)

## Getting Started
### 1. Install dependencies
```bash
npm install
```

### 2. Run in development
```bash
npm run dev
```

### 3. Build for production
```bash
npm run build
```

### 4. Preview production build
```bash
npm run preview
```

## Project Structure
```text
src/
  App.tsx
  features/labelwise/
    components/
    constants.ts
    types.ts
    utils/
  components/ui/
  lib/
```

## CSV Format
The app exports and imports one row per annotation:

```csv
label_name,bbox_x,bbox_y,bbox_width,bbox_height,image_name,image_width,image_height
car,2660,2640,757,241,image_001.png,3613,10821
person,2660,2904,757,217,image_001.png,3613,10821
```

## Roadmap (Suggested)
- Keyboard shortcuts help panel.
- Undo/redo history.
- Annotation snapping to grid.
- Team collaboration and versioned datasets.

## Contributing
Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR.

## License
Licensed under the [MIT License](./LICENSE).
