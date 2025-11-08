const fs = require('fs');
const path = require('path');

// Generate dynamic catalog based on common furniture categories
const generateDynamicCatalog = () => {
  const categories = {
    Furniture: [
      { base: "Sofa", styles: ["Modern", "Classic", "Sectional", "Loveseat"] },
      { base: "Chair", styles: ["Accent", "Dining", "Office", "Lounge"] },
      { base: "Table", styles: ["Coffee", "Side", "Console", "Dining"] },
      { base: "Storage", styles: ["Bookshelf", "Cabinet", "Dresser", "TV Stand"] }
    ],
    Lighting: [
      { base: "Lamp", styles: ["Floor", "Table", "Desk", "Arc"] },
      { base: "Ceiling", styles: ["Pendant", "Chandelier", "Flush Mount", "Track"] }
    ],
    Decor: [
      { base: "Art", styles: ["Canvas", "Framed Print", "Wall Sculpture", "Gallery Set"] },
      { base: "Plant", styles: ["Potted", "Hanging", "Succulent", "Tree"] },
      { base: "Mirror", styles: ["Wall", "Floor", "Decorative", "Vanity"] }
    ],
    Textiles: [
      { base: "Rug", styles: ["Area", "Runner", "Round", "Outdoor"] },
      { base: "Curtains", styles: ["Sheer", "Blackout", "Thermal", "Decorative"] },
      { base: "Pillows", styles: ["Throw", "Lumbar", "Floor", "Outdoor"] }
    ]
  };

  const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FECA57", "#DDA0DD", "#98D8C8", "#F7DC6F"];
  const catalog = [];
  let id = 1;

  Object.entries(categories).forEach(([category, items]) => {
    items.forEach(item => {
      item.styles.forEach(style => {
        const price = Math.floor(Math.random() * 500) + 50;
        const colorTags = [];
        for (let i = 0; i < 3; i++) {
          colorTags.push(colors[Math.floor(Math.random() * colors.length)]);
        }

        catalog.push({
          id: id++,
          title: `${style} ${item.base}`,
          desc: `Beautiful ${style.toLowerCase()} ${item.base.toLowerCase()} perfect for modern homes`,
          price: `$${price}`,
          category: category,
          image: `https://source.unsplash.com/400x300/?${style},${item.base},interior`,
          colorTags: colorTags,
          tags: [style.toLowerCase(), item.base.toLowerCase(), category.toLowerCase()]
        });
      });
    });
  });

  return catalog;
};

// Save to file
const catalog = generateDynamicCatalog();
fs.writeFileSync(
  path.join(__dirname, 'catalog.json'),
  JSON.stringify(catalog, null, 2)
);

console.log(`Generated ${catalog.length} items in catalog.json`);