import fs from 'fs';

const SKUs = [
  { id: 'SKU001', price: 50000, dailyAvgQty: 0.5 },
  { id: 'SKU002', price: 10, dailyAvgQty: 3000 },
  { id: 'SKU003', price: 500, dailyAvgQty: 25 },
  { id: 'SKU004', price: 1000, dailyAvgQty: 5 },
];

const methods = ['Credit Card', 'Cash', 'UPI'];
const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai'];

let csv = 'sku,date,quantity,revenue,discount,payment_method,store_city\n';

const startDate = new Date('2023-10-01');
// 180 days = ~6 months
for (let i = 0; i < 180; i++) {
  const currentDate = new Date(startDate);
  currentDate.setDate(startDate.getDate() + i);
  const dateStr = currentDate.toISOString().split('T')[0];

  // Add a seasonal trend (sin wave) + overall growth
  const growth = 1 + (i / 180) * 0.8; // 80% growth over 6 months
  const seasonality = 1 + Math.sin(i / 15) * 0.3; // 30% fluctuation
  const trend = growth * seasonality;

  SKUs.forEach(sku => {
    // Introduce some randomness
    if (Math.random() > 0.2) { // 80% chance to sell on a given day
      let qty = Math.floor(sku.dailyAvgQty * trend * (0.5 + Math.random()));
      if (qty < 1 && Math.random() > 0.5) qty = 1;
      
      if (qty >= 1) {
        const rev = qty * sku.price;
        const method = methods[Math.floor(Math.random() * methods.length)];
        const city = cities[Math.floor(Math.random() * cities.length)];
        csv += `${sku.id},${dateStr},${qty},${rev},0,${method},${city}\n`;
      }
    }
  });
}

fs.writeFileSync('e:\\KLAROS\\public\\New dataset\\sales.csv', csv);
console.log('Successfully generated 6 months of sales data!');
