let currentUser = null;

export const getMockUser = () => currentUser;
export const setMockUser = (user) => { currentUser = user; };
export const clearMockUser = () => { currentUser = null; };
