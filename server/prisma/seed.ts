import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.promoCode.createMany({
    data: [
      {
        code: 'RIDE20',
        discountType: 'PERCENT',
        discountValue: 20,
        maxDiscount: 50,
        minFare: 100,
        description: '20% off, max ₹50 discount, min fare ₹100',
      },
      {
        code: 'FIRST50',
        discountType: 'FLAT',
        discountValue: 50,
        minFare: 150,
        description: '₹50 flat off, min fare ₹150',
      },
      {
        code: 'WELCOME',
        discountType: 'PERCENT',
        discountValue: 15,
        maxDiscount: 30,
        minFare: 0,
        description: '15% off, max ₹30 discount, no min fare',
      },
    ],
    skipDuplicates: true,
  });
  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
