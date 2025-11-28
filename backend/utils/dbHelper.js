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

module.exports = {
    isPostgres,
    getDefaultImageSubquery,
    getVariantImageSubquery,
    getExcerptFn
};
