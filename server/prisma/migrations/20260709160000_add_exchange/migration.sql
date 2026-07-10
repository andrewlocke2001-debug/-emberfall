-- CreateTable
CREATE TABLE "ExchangeOrder" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "coinsToCollect" INTEGER NOT NULL DEFAULT 0,
    "itemsToCollect" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeTrade" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeTrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExchangeOrder_itemId_side_idx" ON "ExchangeOrder"("itemId", "side");

-- CreateIndex
CREATE INDEX "ExchangeOrder_accountId_idx" ON "ExchangeOrder"("accountId");

-- CreateIndex
CREATE INDEX "ExchangeTrade_itemId_at_idx" ON "ExchangeTrade"("itemId", "at");
