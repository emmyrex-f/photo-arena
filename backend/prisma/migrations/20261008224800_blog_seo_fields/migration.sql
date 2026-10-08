-- Blog SEO fields already on the Prisma model. Existing posts (none) keep nulls.

ALTER TABLE "BlogPost" ADD COLUMN "metaTitle" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN "metaDescription" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN "ogImageUrl" TEXT;
