'use strict';

/**
 * Helper functions for database compatibility between MSSQL and PostgreSQL
 */

const isPostgres = () => process.env.NODE_ENV === 'production';

/**
 * Get default image subquery compatible with both MSSQL and PostgreSQL
 * @param {string} productAlias - The alias used for Product table (e.g., 'Product', 'p')
 * @returns {string} SQL subquery string
 */
const getDefaultImageSubquery = (productAlias = 'Product') => {
    if (isPostgres()) {
        // PostgreSQL syntax
        return `(
            COALESCE(
                (SELECT pi."ImageURL" FROM "ProductImages" pi WHERE pi."ProductID" = "${productAlias}"."ProductID" AND pi."IsDefault" = true AND pi."VariantID" IS NOT NULL ORDER BY pi."ImageID" LIMIT 1),
                (SELECT pi2."ImageURL" FROM "ProductImages" pi2 WHERE pi2."ProductID" = "${productAlias}"."ProductID" AND pi2."IsDefault" = true ORDER BY pi2."ImageID" LIMIT 1),
                (SELECT pi3."ImageURL" FROM "ProductImages" pi3 WHERE pi3."ProductID" = "${productAlias}"."ProductID" ORDER BY pi3."IsDefault" DESC, pi3."ImageID" LIMIT 1),
                '/images/placeholder-product.jpg'
            )
        )`;
    } else {
        // MSSQL syntax
        return `(
            COALESCE(
                (SELECT TOP 1 pi.ImageURL FROM ProductImages pi WHERE pi.ProductID = ${productAlias}.ProductID AND pi.IsDefault = 1 AND pi.VariantID IS NOT NULL ORDER BY pi.ImageID),
                (SELECT TOP 1 pi2.ImageURL FROM ProductImages pi2 WHERE pi2.ProductID = ${productAlias}.ProductID AND pi2.IsDefault = 1 ORDER BY pi2.ImageID),
                (SELECT TOP 1 pi3.ImageURL FROM ProductImages pi3 WHERE pi3.ProductID = ${productAlias}.ProductID ORDER BY pi3.IsDefault DESC, pi3.ImageID),
                '/images/placeholder-product.jpg'
            )
        )`;
    }
};

/**
 * Get variant image subquery compatible with both MSSQL and PostgreSQL
 * @param {string} variantAlias - The alias used for Variant table
 * @param {string} productAlias - The alias used for Product table
 * @returns {string} SQL subquery string
 */
const getVariantImageSubquery = (variantAlias = 'ProductVariant', productAlias = 'Product') => {
    if (isPostgres()) {
        return `(
            COALESCE(
                (SELECT pi."ImageURL" FROM "ProductImages" pi 
                 WHERE pi."VariantID" = "${variantAlias}"."VariantID" AND pi."IsDefault" = true 
                 ORDER BY pi."ImageID" LIMIT 1),
                (SELECT pi2."ImageURL" FROM "ProductImages" pi2 
                 WHERE pi2."ProductID" = "${productAlias}"."ProductID" AND pi2."IsDefault" = true 
                 ORDER BY pi2."ImageID" LIMIT 1),
                (SELECT pi3."ImageURL" FROM "ProductImages" pi3 
                 WHERE pi3."ProductID" = "${productAlias}"."ProductID" 
                 ORDER BY pi3."IsDefault" DESC, pi3."ImageID" LIMIT 1),
                '/images/placeholder-product.jpg'
            )
        )`;
    } else {
        return `(
            COALESCE(
                (SELECT TOP 1 pi.ImageURL FROM ProductImages pi 
                 WHERE pi.VariantID = ${variantAlias}.VariantID AND pi.IsDefault = 1 
                 ORDER BY pi.ImageID),
                (SELECT TOP 1 pi2.ImageURL FROM ProductImages pi2 
                 WHERE pi2.ProductID = ${productAlias}.ProductID AND pi2.IsDefault = 1 
                 ORDER BY pi2.ImageID),
                (SELECT TOP 1 pi3.ImageURL FROM ProductImages pi3 
                 WHERE pi3.ProductID = ${productAlias}.ProductID 
                 ORDER BY pi3.IsDefault DESC, pi3.ImageID),
                '/images/placeholder-product.jpg'
            )
        )`;
    }
};

/**
 * Get text excerpt function compatible with both MSSQL and PostgreSQL
 * @param {object} Sequelize - Sequelize instance
 * @param {string} column - Column name
 * @param {number} length - Max length
 * @returns {object} Sequelize function
 */
const getExcerptFn = (Sequelize, column, length = 400) => {
    if (isPostgres()) {
        return Sequelize.fn('SUBSTRING', Sequelize.col(column), 1, length);
    } else {
        return Sequelize.fn('LEFT', Sequelize.col(column), length);
    }
};

/**
 * Get top selling products query for dashboard (PostgreSQL/MSSQL compatible)
 */
const getTopProductsQuery = (successfulOrderStatus) => {
    if (isPostgres()) {
        return `
            SELECT 
                p."ProductID", p."Name", pv."VariantID", pv."Size", pv."Color", 
                p."Price", p."DiscountPercent",
                ROUND(p."Price" * (1 - COALESCE(p."DiscountPercent", 0) / 100.0)) AS "DiscountedPrice",
                SUM(qty) AS sold,
                (
                    COALESCE(
                        (SELECT i."ImageURL" FROM "ProductImages" i WHERE i."VariantID" = pv."VariantID" ORDER BY i."IsDefault" DESC, i."ImageID" ASC LIMIT 1),
                        (SELECT i_color."ImageURL" FROM "ProductImages" i_color JOIN "ProductVariants" pv_color ON i_color."VariantID" = pv_color."VariantID" WHERE pv_color."ProductID" = p."ProductID" AND pv_color."Color" = pv."Color" ORDER BY i_color."IsDefault" DESC, i_color."ImageID" ASC LIMIT 1),
                        (SELECT i_prod_def."ImageURL" FROM "ProductImages" i_prod_def WHERE i_prod_def."ProductID" = p."ProductID" AND i_prod_def."VariantID" IS NULL ORDER BY i_prod_def."IsDefault" DESC, i_prod_def."ImageID" ASC LIMIT 1),
                        (SELECT i_any."ImageURL" FROM "ProductImages" i_any WHERE i_any."ProductID" = p."ProductID" ORDER BY i_any."ImageID" ASC LIMIT 1)
                    )
                ) AS "DefaultImage"
            FROM (
                SELECT oi."Quantity" AS qty, oi."VariantID" FROM "OrderItems" oi JOIN "Orders" o ON o."OrderID" = oi."OrderID" WHERE o."Status" IN (:statuses)
                UNION ALL
                SELECT goi."Quantity" AS qty, goi."VariantID" FROM "GuestOrderItems" goi JOIN "GuestOrders" go ON go."GuestOrderID" = goi."GuestOrderID" WHERE go."Status" IN (:statuses)
            ) AS "allItems"
            JOIN "ProductVariants" pv ON "allItems"."VariantID" = pv."VariantID"
            JOIN "Products" p ON pv."ProductID" = p."ProductID"
            GROUP BY p."ProductID", p."Name", pv."VariantID", pv."Size", pv."Color", p."Price", p."DiscountPercent"
            ORDER BY sold DESC
            LIMIT :limit OFFSET :offset
        `;
    } else {
        return `
            SELECT 
                p.ProductID, p.Name, pv.VariantID, pv.Size, pv.Color, 
                p.Price, p.DiscountPercent, p.DiscountedPrice, 
                SUM(qty) AS sold,
                (
                    COALESCE(
                        (SELECT TOP 1 i.ImageURL FROM ProductImages i WHERE i.VariantID = pv.VariantID ORDER BY i.IsDefault DESC, i.ImageID ASC),
                        (SELECT TOP 1 i_color.ImageURL FROM ProductImages i_color JOIN ProductVariants pv_color ON i_color.VariantID = pv_color.VariantID WHERE pv_color.ProductID = p.ProductID AND pv_color.Color = pv.Color ORDER BY i_color.IsDefault DESC, i_color.ImageID ASC),
                        (SELECT TOP 1 i_prod_def.ImageURL FROM ProductImages i_prod_def WHERE i_prod_def.ProductID = p.ProductID AND i_prod_def.VariantID IS NULL ORDER BY i_prod_def.IsDefault DESC, i_prod_def.ImageID ASC),
                        (SELECT TOP 1 i_any.ImageURL FROM ProductImages i_any WHERE i_any.ProductID = p.ProductID ORDER BY i_any.ImageID ASC)
                    )
                ) AS DefaultImage
            FROM (
                SELECT oi.Quantity AS qty, oi.VariantID FROM OrderItems oi JOIN Orders o ON o.OrderID = oi.OrderID WHERE o.Status IN (:statuses)
                UNION ALL
                SELECT goi.Quantity AS qty, goi.VariantID FROM GuestOrderItems goi JOIN GuestOrders go ON go.GuestOrderID = goi.GuestOrderID WHERE go.Status IN (:statuses)
            ) AS allItems
            JOIN ProductVariants pv ON allItems.VariantID = pv.VariantID
            JOIN Products p ON pv.ProductID = p.ProductID
            GROUP BY p.ProductID, p.Name, pv.VariantID, pv.Size, pv.Color, p.Price, p.DiscountPercent, p.DiscountedPrice
            ORDER BY sold DESC
            OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
        `;
    }
};

/**
 * Get top products total count query
 */
const getTopProductsTotalQuery = () => {
    if (isPostgres()) {
        return `
            SELECT COUNT(DISTINCT "allItems"."VariantID") AS "totalItems"
            FROM (
                SELECT oi."VariantID" FROM "OrderItems" oi JOIN "Orders" o ON o."OrderID" = oi."OrderID" WHERE o."Status" IN (:statuses)
                UNION ALL
                SELECT goi."VariantID" FROM "GuestOrderItems" goi JOIN "GuestOrders" go ON go."GuestOrderID" = goi."GuestOrderID" WHERE go."Status" IN (:statuses)
            ) AS "allItems"
        `;
    } else {
        return `
            SELECT COUNT(DISTINCT allItems.VariantID) AS totalItems
            FROM (
                SELECT oi.VariantID FROM OrderItems oi JOIN Orders o ON o.OrderID = oi.OrderID WHERE o.Status IN (:statuses)
                UNION ALL
                SELECT goi.VariantID FROM GuestOrderItems goi JOIN GuestOrders go ON go.GuestOrderID = goi.GuestOrderID WHERE go.Status IN (:statuses)
            ) AS allItems
        `;
    }
};

/**
 * Get revenue chart data query
 */
const getRevenueChartQuery = () => {
    if (isPostgres()) {
        return `
            SELECT DATE("date") as date, SUM(revenue) AS revenue FROM (
                SELECT "OrderDate" AS date, "TotalAmount" AS revenue FROM "Orders" WHERE "Status" IN (:statuses) AND "OrderDate" >= :startDate
                UNION ALL
                SELECT "OrderDate" AS date, "TotalAmount" AS revenue FROM "GuestOrders" WHERE "Status" IN (:statuses) AND "OrderDate" >= :startDate
            ) AS combined
            GROUP BY DATE("date") ORDER BY date
        `;
    } else {
        return `
            SELECT CAST(date AS DATE) as date, SUM(revenue) AS revenue FROM (
                SELECT OrderDate AS date, TotalAmount AS revenue FROM Orders WHERE Status IN (:statuses) AND OrderDate >= :startDate
                UNION ALL
                SELECT OrderDate AS date, TotalAmount AS revenue FROM GuestOrders WHERE Status IN (:statuses) AND OrderDate >= :startDate
            ) AS combined
            GROUP BY CAST(date AS DATE) ORDER BY date
        `;
    }
};

/**
 * Get orders chart data query
 */
const getOrdersChartQuery = () => {
    if (isPostgres()) {
        return `
            SELECT DATE("date") as date, COUNT(*) AS orders FROM (
                SELECT "OrderDate" AS date FROM "Orders" WHERE "Status" IN (:statuses) AND "OrderDate" >= :startDate
                UNION ALL
                SELECT "OrderDate" AS date FROM "GuestOrders" WHERE "Status" IN (:statuses) AND "OrderDate" >= :startDate
            ) AS combined
            GROUP BY DATE("date") ORDER BY date
        `;
    } else {
        return `
            SELECT CAST(date AS DATE) as date, COUNT(*) AS orders FROM (
                SELECT OrderDate AS date FROM Orders WHERE Status IN (:statuses) AND OrderDate >= :startDate
                UNION ALL
                SELECT OrderDate AS date FROM GuestOrders WHERE Status IN (:statuses) AND OrderDate >= :startDate
            ) AS combined
            GROUP BY CAST(date AS DATE) ORDER BY date
        `;
    }
};

/**
 * Get order items image subquery for cart
 */
const getCartImageSubquery = (variantAlias = 'variant') => {
    if (isPostgres()) {
        return `COALESCE(
    (SELECT pi."ImageURL"
     FROM "ProductImages" pi
     WHERE pi."VariantID" = "${variantAlias}"."VariantID"
     ORDER BY pi."IsDefault" DESC, pi."ImageID" LIMIT 1),

    (SELECT pi2."ImageURL"
     FROM "ProductImages" pi2
     INNER JOIN "ProductVariants" pv2 ON pi2."VariantID" = pv2."VariantID"
     WHERE pi2."ProductID" = "${variantAlias}"."ProductID"
       AND pv2."Color" = "${variantAlias}"."Color"
     ORDER BY pi2."IsDefault" DESC, pi2."ImageID" LIMIT 1),

    (SELECT pi3."ImageURL"
     FROM "ProductImages" pi3
     WHERE pi3."ProductID" = "${variantAlias}"."ProductID"
     ORDER BY pi3."IsDefault" DESC, pi3."ImageID" LIMIT 1),

    '/placeholder.jpg'
)`;
    } else {
        return `COALESCE(
    (SELECT TOP 1 pi.ImageURL
     FROM ProductImages pi
     WHERE pi.VariantID = ${variantAlias}.VariantID
     ORDER BY pi.IsDefault DESC, pi.ImageID),

    (SELECT TOP 1 pi2.ImageURL
     FROM ProductImages pi2
     INNER JOIN ProductVariants pv2 ON pi2.VariantID = pv2.VariantID
     WHERE pi2.ProductID = ${variantAlias}.ProductID
       AND pv2.Color = ${variantAlias}.Color
     ORDER BY pi2.IsDefault DESC, pi2.ImageID),

    (SELECT TOP 1 pi3.ImageURL
     FROM ProductImages pi3
     WHERE pi3.ProductID = ${variantAlias}.ProductID
     ORDER BY pi3.IsDefault DESC, pi3.ImageID),

    '/placeholder.jpg'
)`;
    }
};

module.exports = {
    isPostgres,
    getDefaultImageSubquery,
    getVariantImageSubquery,
    getExcerptFn,
    getTopProductsQuery,
    getTopProductsTotalQuery,
    getRevenueChartQuery,
    getOrdersChartQuery,
    getCartImageSubquery
};
