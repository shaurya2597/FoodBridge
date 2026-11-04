import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as admin from '../services/adminService';
import * as complaints from '../services/complaintService';

const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });
const paged = (res: Response, r: { data: unknown; meta: unknown }) => res.json({ success: true, data: r.data, meta: r.meta });

export const dashboard = asyncHandler(async (_req: Request, res: Response) => ok(res, await admin.getDashboard()));
export const analytics = asyncHandler(async (req: Request, res: Response) => ok(res, await admin.getAnalytics(Number((req.query as any).days))));

export const users = asyncHandler(async (req: Request, res: Response) => paged(res, await admin.listUsers(req.query)));
export const blockUser = asyncHandler(async (req: Request, res: Response) => ok(res, await admin.setUserBlocked(req.user!, req.params.id, req.body)));

export const restaurants = asyncHandler(async (req: Request, res: Response) => paged(res, await admin.listRestaurants(req.query)));
export const restaurantStatus = asyncHandler(async (req: Request, res: Response) => ok(res, await admin.setRestaurantStatus(req.user!, req.params.id, req.body)));

export const orders = asyncHandler(async (req: Request, res: Response) => paged(res, await admin.listOrders(req.query)));
export const order = asyncHandler(async (req: Request, res: Response) => ok(res, await admin.getOrderDetail(req.params.id)));

export const ngos = asyncHandler(async (req: Request, res: Response) => paged(res, await admin.listNgos(req.query)));
export const verifyNgo = asyncHandler(async (req: Request, res: Response) => ok(res, await admin.setNgoVerification(req.user!, req.params.id, req.body)));

export const donations = asyncHandler(async (req: Request, res: Response) => paged(res, await admin.listDonations(req.query)));
export const donation = asyncHandler(async (req: Request, res: Response) => ok(res, await admin.getDonationDetail(req.params.id)));
export const donationRequests = asyncHandler(async (req: Request, res: Response) => paged(res, await admin.listDonationRequests(req.query)));
export const flagDonation = asyncHandler(async (req: Request, res: Response) => ok(res, await admin.flagDonation(req.user!, req.params.id, req.body.reason)));
export const unflagDonation = asyncHandler(async (req: Request, res: Response) => ok(res, await admin.unflagDonation(req.user!, req.params.id, req.body?.reason)));

export const complaintList = asyncHandler(async (req: Request, res: Response) => paged(res, await admin.listComplaints(req.query)));
export const complaint = asyncHandler(async (req: Request, res: Response) => ok(res, await admin.getComplaint(req.params.id)));
export const updateComplaint = asyncHandler(async (req: Request, res: Response) => ok(res, await admin.updateComplaint(req.user!, req.params.id, req.body)));

export const auditLogs = asyncHandler(async (req: Request, res: Response) => paged(res, await admin.listAuditLogs(req.query)));

// ---- customer-facing complaint endpoints (any logged-in user may complain about their own order/donation)
export const createMyComplaint = asyncHandler(async (req: Request, res: Response) => ok(res, await complaints.createComplaint(req.user!, req.body), 201));
export const listMyComplaints = asyncHandler(async (req: Request, res: Response) => paged(res, await complaints.listMyComplaints(req.user!, req.query as any)));
export const getMyComplaint = asyncHandler(async (req: Request, res: Response) => ok(res, await complaints.getMyComplaint(req.user!, req.params.id)));
