/**
 * Search Engine Logic
 * Filters the mock database.
 */

const SearchEngine = {

    /**
     * Search the 'directories' database
     * @param {string} query 
     * @returns {Promise<Array>}
     */
    searchDirectories: async (query) => {
        const db = await fetch('data/database.json').then(res => res.json());
        const lowerQ = query.toLowerCase();

        return db.directories.filter(item =>
            item.name.toLowerCase().includes(lowerQ)
        );
    },

    /**
     * Search the 'websites' database
     * @param {string} query 
     * @returns {Promise<Array>}
     */
    searchWeb: async (query) => {
        const db = await fetch('data/database.json').then(res => res.json());
        const lowerQ = query.toLowerCase();

        return db.websites.filter(item =>
            item.name.toLowerCase().includes(lowerQ) ||
            item.desc.toLowerCase().includes(lowerQ)
        );
    }
};

export default SearchEngine;
