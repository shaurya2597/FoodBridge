/** Room names shared by the socket server and the event emitters (kept apart to avoid circular imports). */
export const NGO_ROOM = 'ngo:available';        // verified NGOs only (checked when the socket connects)
export const ADMIN_DONATION_ROOM = 'admin:donations';
