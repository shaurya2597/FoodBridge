import 'dotenv/config';
import { PrismaClient, FoodType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const img = (text: string, color = 'f97316') =>
  `https://placehold.co/800x600/${color}/ffffff?text=${encodeURIComponent(text)}`;
const hours = (h: number) => new Date(Date.now() + h * 3600_000);

type Dish = [name: string, desc: string, price: number, type: 'VEG' | 'NON_VEG', popular?: boolean];
type Seed = {
  name: string; owner: string; desc: string; cuisines: string[]; city: string; address: string;
  rating: number; count: number; time: number; fee: number; min: number; two: number; veg?: boolean;
  menu: Record<string, Dish[]>;
};

const restaurants: Seed[] = [
  { name: 'Rajputana Rasoi', owner: 'owner1', desc: 'Royal Rajasthani and North Indian thalis cooked in ghee, the way Jodhpur likes it.',
    cuisines: ['North Indian', 'Rajasthani'], city: 'Jodhpur', address: 'Sardarpura, Jodhpur', rating: 4.5, count: 1240, time: 30, fee: 30, min: 150, two: 450,
    menu: {
      'Main Course': [['Paneer Butter Masala', 'Cottage cheese in a rich tomato-butter gravy', 260, 'VEG', true], ['Dal Baati Churma', 'Baked wheat balls with lentils and sweet churma', 230, 'VEG', true], ['Butter Chicken', 'Tandoori chicken in creamy makhani sauce', 340, 'NON_VEG']],
      Breads: [['Butter Naan', 'Soft tandoor-baked naan', 55, 'VEG'], ['Missi Roti', 'Gram flour roti with spices', 45, 'VEG']],
      Desserts: [['Gulab Jamun', 'Two warm milk dumplings in sugar syrup', 80, 'VEG', true]],
    } },
  { name: 'Biryani Junction', owner: 'owner1', desc: 'Dum-cooked Hyderabadi biryani with slow-sealed handi flavour.',
    cuisines: ['Biryani', 'Mughlai'], city: 'Jodhpur', address: 'Paota, Jodhpur', rating: 4.4, count: 980, time: 35, fee: 40, min: 200, two: 500,
    menu: {
      Biryani: [['Chicken Biryani', 'Basmati layered with spiced chicken, served with raita', 280, 'NON_VEG', true], ['Veg Biryani', 'Aromatic basmati with seasonal vegetables', 220, 'VEG', true], ['Mutton Biryani', 'Slow-cooked mutton dum biryani', 380, 'NON_VEG']],
      Starters: [['Chicken 65', 'Crispy South Indian style fried chicken', 240, 'NON_VEG'], ['Paneer Tikka', 'Charred marinated paneer', 230, 'VEG']],
      Beverages: [['Masala Chaas', 'Spiced buttermilk', 50, 'VEG']],
    } },
  { name: 'Dosa Darbar', owner: 'owner2', desc: 'Crisp dosas, fluffy idlis and filter coffee, 100% vegetarian.',
    cuisines: ['South Indian'], city: 'Jodhpur', address: 'Shastri Nagar, Jodhpur', rating: 4.3, count: 760, time: 25, fee: 20, min: 100, two: 300, veg: true,
    menu: {
      Dosas: [['Masala Dosa', 'Crispy dosa with spiced potato filling', 120, 'VEG', true], ['Mysore Masala Dosa', 'Red chutney smeared dosa with potato', 140, 'VEG'], ['Rava Dosa', 'Lacy semolina dosa', 130, 'VEG']],
      Sides: [['Idli Sambar (3 pcs)', 'Steamed rice cakes with sambar and chutneys', 90, 'VEG', true], ['Medu Vada', 'Crisp lentil doughnuts', 85, 'VEG']],
      Beverages: [['Filter Coffee', 'Frothy South Indian filter coffee', 50, 'VEG']],
    } },
  { name: 'Wok & Roll', owner: 'owner2', desc: 'Indo-Chinese street favourites tossed on a roaring flame.',
    cuisines: ['Chinese'], city: 'Jodhpur', address: 'Ratanada, Jodhpur', rating: 4.1, count: 540, time: 30, fee: 35, min: 180, two: 400,
    menu: {
      Noodles: [['Hakka Noodles', 'Wok-tossed noodles with crunchy vegetables', 170, 'VEG', true], ['Chicken Hakka Noodles', 'Hakka noodles with shredded chicken', 210, 'NON_VEG']],
      Starters: [['Veg Manchurian', 'Fried vegetable balls in tangy gravy', 180, 'VEG', true], ['Chilli Chicken', 'Crispy chicken in spicy soy glaze', 250, 'NON_VEG']],
    } },
  { name: 'Pizza Piazza', owner: 'owner1', desc: 'Hand-stretched pizzas and comforting pastas.',
    cuisines: ['Italian', 'Pizza'], city: 'Jodhpur', address: 'Residency Road, Jodhpur', rating: 4.2, count: 690, time: 35, fee: 45, min: 250, two: 600,
    menu: {
      Pizzas: [['Margherita Pizza', 'Classic tomato, mozzarella and basil', 249, 'VEG', true], ['Farmhouse Pizza', 'Loaded with capsicum, onion, mushroom, corn', 329, 'VEG'], ['Pepperoni Pizza', 'Chicken pepperoni with mozzarella', 379, 'NON_VEG']],
      Pasta: [['Penne Arrabbiata', 'Spicy tomato penne', 229, 'VEG']],
    } },
  { name: 'Burger Barn', owner: 'owner2', desc: 'Stacked burgers, fries and thick shakes. Desserts included.',
    cuisines: ['Burgers', 'Desserts'], city: 'Jodhpur', address: 'Chopasni Road, Jodhpur', rating: 4.0, count: 410, time: 25, fee: 25, min: 120, two: 350,
    menu: {
      Burgers: [['Veg Burger', 'Crispy veg patty with cheese and mayo', 99, 'VEG', true], ['Chicken Zinger Burger', 'Crunchy fried chicken burger', 169, 'NON_VEG']],
      Desserts: [['Chocolate Brownie', 'Warm fudgy brownie', 110, 'VEG'], ['Oreo Shake', 'Thick cookies and cream shake', 150, 'VEG']],
    } },
];

// Every model in schema.prisma, ordered children-first so deleteMany never violates a foreign key.
const MODELS = [
  'notification', 'complaint', 'donationRequest', 'donation', 'foodAssistanceRequest', 'review', 'payment',
  'orderItem', 'order', 'cartItem', 'cart', 'coupon', 'foodItem', 'foodCategory', 'restaurant',
  'nGOProfile', 'address', 'user',
] as const;

async function main() {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password || password.length < 8) throw new Error('Set SEED_DEMO_PASSWORD (min 8 chars) in .env before seeding');
  if (Buffer.byteLength(password, 'utf8') > 72) throw new Error('SEED_DEMO_PASSWORD must be at most 72 bytes (bcrypt limit)');
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed demo data in production');

  // Safety gate: count rows in EVERY model. Any existing row means "not an empty database".
  const target = (() => { try { const u = new URL(process.env.DATABASE_URL ?? ''); return `${u.hostname}${u.pathname}`; } catch { return 'unknown'; } })();
  const counts = await Promise.all(MODELS.map(async (m) => [m, await (prisma as any)[m].count()] as const));
  const nonEmpty = counts.filter(([, n]) => n > 0);
  const totalRows = nonEmpty.reduce((sum, [, n]) => sum + n, 0);
  const confirmed = process.env.RESET_DEMO_DATA === 'true';

  if (totalRows > 0 && !confirmed) {
    console.error(`\nSeed aborted: database ${target} is not empty. Nothing was changed.`);
    console.error('Existing rows: ' + nonEmpty.map(([m, n]) => `${m}=${n}`).join(', '));
    console.error('To DELETE ALL DATA in this database and reseed demo data, run:  npm run prisma:seed:reset\n');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  if (totalRows > 0) {
    console.warn(`RESET_DEMO_DATA=true: deleting ALL ${totalRows} rows in ${target} ...`);
    // One transaction: either everything is wiped or nothing is. Children are deleted before parents.
    await prisma.$transaction(MODELS.map((m) => (prisma as any)[m].deleteMany()));
  }

  const mk = (name: string, email: string, role: any, phone: string) =>
    prisma.user.create({ data: { name, email, role, phone, passwordHash } });
  const admin = await mk('Platform Admin', 'admin@foodbridge.demo', 'ADMIN', '9000000001');
  const customer = await mk('Aarav Sharma', 'customer@foodbridge.demo', 'CUSTOMER', '9000000002');
  const owners = { owner1: await mk('Meera Rathore', 'owner1@foodbridge.demo', 'RESTAURANT_OWNER', '9000000003'),
                   owner2: await mk('Kabir Singh', 'owner2@foodbridge.demo', 'RESTAURANT_OWNER', '9000000004') };
  const ngoUser = await mk('Anand Joshi', 'ngo@foodbridge.demo', 'NGO', '9000000005');
  const ngo = await prisma.nGOProfile.create({ data: {
    userId: ngoUser.id, orgName: 'Annapurna Seva Trust', registrationNo: 'NGO-RJ-2019-0412', contactEmail: ngoUser.email,
    contactPhone: '9000000005', serviceCity: 'Jodhpur', serviceArea: 'Old City and Sardarpura', isVerified: true,
    description: 'Distributes surplus meals to shelters and daily-wage families.' } });

  await prisma.address.create({ data: { userId: customer.id, line1: '12, Shastri Circle', city: 'Jodhpur', state: 'Rajasthan', pincode: '342003', isDefault: true } });

  const restaurantIds: Record<string, string> = {};
  const palette = ['f97316', 'ef4444', '16a34a', 'b45309', 'dc2626', '7c3aed'];
  for (const [i, r] of restaurants.entries()) {
    const rest = await prisma.restaurant.create({ data: {
      ownerId: owners[r.owner as 'owner1'].id, name: r.name, slug: r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: r.desc, cuisines: r.cuisines, imageUrl: img(r.name, palette[i]), bannerUrl: img(r.name, palette[i]),
      address: r.address, city: r.city, rating: r.rating, ratingCount: r.count, deliveryTime: r.time,
      deliveryFee: r.fee, minOrder: r.min, priceForTwo: r.two, isVegOnly: !!r.veg, status: 'APPROVED' } });
    restaurantIds[r.name] = rest.id;
    let order = 0;
    for (const [cat, dishes] of Object.entries(r.menu)) {
      const c = await prisma.foodCategory.create({ data: { restaurantId: rest.id, name: cat, sortOrder: order++ } });
      for (const [name, description, price, type, popular] of dishes)
        await prisma.foodItem.create({ data: { restaurantId: rest.id, categoryId: c.id, name, description, price,
          foodType: type as FoodType, imageUrl: img(name, palette[i]), isPopular: !!popular, rating: Math.round((3.8 + ((name.length % 10) / 10)) * 10) / 10 } });
    }
  }
  // One pending restaurant so the admin approval flow has something to show.
  await prisma.restaurant.create({ data: { ownerId: owners.owner2.id, name: 'Chaat Corner (pending)', slug: 'chaat-corner', description: 'Street-style chaat awaiting admin approval.',
    cuisines: ['Street Food'], imageUrl: img('Chaat Corner', 'eab308'), address: 'Clock Tower, Jodhpur', city: 'Jodhpur', status: 'PENDING' } });

  await prisma.coupon.createMany({ data: [
    { code: 'WELCOME50', description: '50% off up to ₹100 on your first order', discountType: 'PERCENT', value: 50, maxDiscount: 100, minOrder: 199, validUntil: hours(24 * 365) },
    { code: 'FLAT75', description: '₹75 off orders above ₹500', discountType: 'FLAT', value: 75, minOrder: 500, validUntil: hours(24 * 365) },
  ] });

  const base = { pickupAddress: 'Sardarpura, Jodhpur', city: 'Jodhpur', safetyConfirmed: true, preparedAt: hours(-1) };
  await prisma.donation.create({ data: { ...base, donorId: owners.owner1.id, restaurantId: restaurantIds['Rajputana Rasoi'], donorName: 'Rajputana Rasoi', donorType: 'RESTAURANT', foodName: 'Dal Baati & Rice (surplus)', category: 'Cooked meal', quantity: '25 boxes', servings: 25, foodType: 'VEG', expiresAt: hours(4), contactPhone: '9000000003', status: 'POSTED', statusHistory: [{ status: 'POSTED', at: new Date().toISOString() }] } });
  const accepted = await prisma.donation.create({ data: { ...base, pickupAddress: '12, Shastri Circle, Jodhpur', donorId: customer.id, restaurantId: null, donorName: 'Aarav Sharma', donorType: 'INDIVIDUAL', foodName: 'Wedding function leftovers', category: 'Cooked meal', quantity: '10 kg', servings: 40, foodType: 'VEG', expiresAt: hours(3), contactPhone: '9000000002', status: 'ACCEPTED', claimedByNgoId: ngo.id, statusHistory: [{ status: 'POSTED', at: hours(-1).toISOString() }, { status: 'ACCEPTED', at: new Date().toISOString() }] } });
  await prisma.donationRequest.create({ data: { donationId: accepted.id, ngoId: ngo.id, message: 'We can collect within 45 minutes.', status: 'APPROVED' } });
  await prisma.foodAssistanceRequest.create({ data: { name: 'Community shelter volunteer', phone: '9000000009', people: 15, requirement: 'Dinner for a night shelter', foodType: 'VEG', location: 'Near Clock Tower', city: 'Jodhpur' } });

  console.log('Seed complete. Demo accounts use the SEED_DEMO_PASSWORD from your .env');
  console.log('admin@ / customer@ / owner1@ / owner2@ / ngo@  (all @foodbridge.demo)');
  void admin;
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
