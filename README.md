# Portfolio Template 
#### author: Sawyer Newman

A minimal, responsive portfolio template for artists, designers, and creative technologists.
  
This template is designed to be lightweight, clean, and image-forward to showcase projects with visual elements, and display associated metadata for each work.

**Live example:** https://sauuyer.github.io

---

## What This Is

- A static portfolio site (HTML / CSS / vanilla JavaScript)
- Image-forward, with optional captions and detailed modal views
- Responsive, accessible, and open source
- Hosted for free through GitHub Pages 

---

## Features

- Fixed-width gallery grid with variable-height images
- Modal lightbox with:
  - Full image (aspect preserved)
  - Title, year, medium, size, notes
- Footer with:
  - About text
  - Optional “Buy me a coffee” link
  - Toggle-to-reveal contact email (spam-resistant)
- About page scaffold included
- Works are data-driven via a single JSON file

---

## Using This as a Template

This repository is marked as a **GitHub template**.

To create your own copy:

1. Click **“Use this template”** on GitHub
2. Create a new repository under your account
3. Edit the content to suit your work
   
You will not inherit this repository’s commit history if you use the template (rather than fork this repo).

---

## Customizing Content

### Gallery Metadata

Edit: /data/gallery.json

Each work supports fields like:

- `image`
- `image2x`
- `title`
- `year`
- `medium`
- `size`
- `credit`
- `index_display_1`
- `index_display_2`
- `order`

Fields left empty are handled gracefully.

### Gallery Works

Each icon (which can be an artwork, or some other visual representation of your project, can be saved in the "works" directory. The directory of each work is specified in the gallery.json file, so you can 
create as many subfolders as you would like.


### Site Title and Tagline

These are set in `gallery.json`:

- `site.title`
- `site.tagline`

### Contact Email (Spam-Resistant)

The email address is assembled client-side to reduce scraping.

In `index.html` and `about.html`, the contact button uses data attributes:

- `data-u`
- `data-d`
- `data-t`

These are combined at runtime into a visible email address when clicked.

---

## Hosting on GitHub Pages

1. Push your repository to GitHub
2. Go to **Settings → Pages**
3. Set source to:
   - Branch: `main`
   - Folder: `/root`
4. Save

Your site will be available at:

https://YOUR-USERNAME.github.io

---

## Image Use and Protection (Important Note)

This is a portfolio, not a DRM system.

- Images are intentionally web-sized
- Right-click and drag are disabled as a light deterrent
- Anyone determined can still download images

If stronger protection matters:
- Use lower-resolution images
- Crop strategically
- Or host originals elsewhere

