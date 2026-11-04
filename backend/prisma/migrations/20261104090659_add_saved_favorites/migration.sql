-- CreateTable
CREATE TABLE "SavedRestaurant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedRestaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedFoodItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "foodItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedFoodItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedRestaurant_userId_createdAt_idx" ON "SavedRestaurant"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedRestaurant_userId_restaurantId_key" ON "SavedRestaurant"("userId", "restaurantId");

-- CreateIndex
CREATE INDEX "SavedFoodItem_userId_createdAt_idx" ON "SavedFoodItem"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedFoodItem_userId_foodItemId_key" ON "SavedFoodItem"("userId", "foodItemId");

-- AddForeignKey
ALTER TABLE "SavedRestaurant" ADD CONSTRAINT "SavedRestaurant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedRestaurant" ADD CONSTRAINT "SavedRestaurant_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFoodItem" ADD CONSTRAINT "SavedFoodItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFoodItem" ADD CONSTRAINT "SavedFoodItem_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
