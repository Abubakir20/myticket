// @ts-check
// Backend javob modellari (JSDoc). Maydonlar src/modules/*/ *.service.ts dagi select/include lardan olingan.
// Prisma Decimal JSON'da string bo'lib keladi — shuning uchun narxlar `Money` (string | number).

/** @typedef {string | number} Money */

/** @typedef {'CUSTOMER' | 'ORGANIZER' | 'CONTROLLER' | 'ADMIN' | 'SUPERADMIN'} Role */
/** @typedef {'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED'} OrderStatus */
/** @typedef {'PENDING' | 'SUCCESS' | 'FAILED'} PaymentStatus */
/** @typedef {'ACTIVE' | 'USED' | 'CANCELLED'} TicketStatus */
/** @typedef {'SEATED' | 'GENERAL'} SeatingType */
/** @typedef {'FREE' | 'HELD' | 'SOLD'} SeatStatus */
/** @typedef {'PENDING' | 'APPROVED' | 'REJECTED'} ApplicationStatus */
/** @typedef {'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'} EventStatus */

/**
 * GET /users/me — frontend faqat shu maydonlarni ishlatadi.
 * @typedef {object} User
 * @property {string} id
 * @property {string | null} fullName
 * @property {string} email
 * @property {Role} role
 * @property {string} status
 * @property {string | null} imageUrl
 */

/**
 * @typedef {object} OtpSent
 * @property {boolean} success
 * @property {string} message
 * @property {number} expiresIn  sekund
 * @property {number} resendAfter  sekund
 * @property {string} [code]  tasdiqlash kodi — sahifada ko'rsatiladi
 */

/** @typedef {{ name: string, address: string }} VenueRef */
/** @typedef {{ id: string, name: string, address: string }} Venue */
/** @typedef {{ id: string, title: string, posterUrl: string }} EventRef */

/**
 * GET /events — ro'yxat elementi
 * @typedef {object} EventListItem
 * @property {string} id
 * @property {string} title
 * @property {string} posterUrl
 * @property {number | null} ageLimit
 * @property {number} duration
 * @property {string | null} nextSessionAt
 * @property {string | null} [venueName]  eng yaqin seans zali
 * @property {number | null} [minPrice]  kelgusi seanslardagi eng arzon chipta
 */

/**
 * @typedef {object} PageMeta
 * @property {number} page
 * @property {number} limit
 * @property {number} total
 * @property {number} totalPages
 */

/** @typedef {{ items: EventListItem[], meta: PageMeta }} EventPage */

/**
 * @typedef {object} EventSession
 * @property {string} id
 * @property {string} startTime
 * @property {SeatingType} seatingType
 * @property {Venue} venue
 * @property {{ id: string, name: string, price: Money }[]} ticketCategories
 */

/**
 * GET /events/:id
 * @typedef {object} EventDetail
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {number | null} ageLimit
 * @property {number} duration
 * @property {string} posterUrl
 * @property {{ id: string, fullName: string | null }} organizer
 * @property {{ id: string, url: string }[]} images
 * @property {EventSession[]} sessions
 */

/**
 * GET /sessions/:id/seats
 * @typedef {object} SeatMap
 * @property {string} sessionId
 * @property {SeatSector[]} sectors
 */
/**
 * @typedef {object} SeatSector
 * @property {string} sectorId
 * @property {string} sectorName
 * @property {string} ticketCategoryId
 * @property {string} categoryName
 * @property {Money} price
 * @property {{ number: number, seats: { seatId: string, number: number, status: SeatStatus }[] }[]} rows
 */

/**
 * GET /sessions/:id/categories (GENERAL)
 * @typedef {object} GeneralCategory
 * @property {string} id
 * @property {string} name
 * @property {Money} price
 * @property {number | null} quantity
 * @property {number} remaining
 */

/**
 * POST /orders
 * @typedef {object} CreatedOrder
 * @property {string} orderId
 * @property {OrderStatus} status
 * @property {string} expiresAt
 * @property {Money} totalPrice
 */

/**
 * @typedef {object} SeatRef
 * @property {number} number
 * @property {{ number: number, sector: { name: string } }} row
 */

/**
 * GET /orders/:id
 * @typedef {object} OrderDetail
 * @property {string} id
 * @property {OrderStatus} status
 * @property {string} expiresAt
 * @property {string} createdAt
 * @property {Money} totalPrice
 * @property {{ id: string, startTime: string, seatingType: SeatingType, event: EventRef, venue: VenueRef }} session
 * @property {{ id: string, price: Money, ticketCategory: { id: string, name: string }, seat: SeatRef | null }[]} items
 * @property {{ status: PaymentStatus, transactionId: string, paidAt: string | null } | null} payment
 */

/**
 * GET /orders/me
 * @typedef {object} OrderListItem
 * @property {string} id
 * @property {OrderStatus} status
 * @property {string} expiresAt
 * @property {string} createdAt
 * @property {number} ticketsCount
 * @property {Money} totalPrice
 * @property {{ id: string, startTime: string, event: EventRef, venue: VenueRef }} session
 * @property {{ status: PaymentStatus, paidAt: string | null } | null} payment
 */

/**
 * @typedef {object} PaymentResult
 * @property {string} orderId
 * @property {PaymentStatus} paymentStatus
 * @property {Money} amount
 */

/**
 * GET /tickets/me, /tickets/:id
 * @typedef {object} Ticket
 * @property {string} id
 * @property {string} qrCode
 * @property {TicketStatus} status
 * @property {string | null} usedAt
 * @property {{ id: string, startTime: string, event: EventRef, venue: VenueRef }} session
 * @property {SeatRef | null} seat
 * @property {{ orderId: string, price: Money, ticketCategory: { name: string } }} orderItem
 */

/**
 * @typedef {object} OrganizerApplication
 * @property {string} id
 * @property {string} companyName
 * @property {string} phone
 * @property {string | null} description
 * @property {ApplicationStatus} status
 * @property {string | null} rejectReason
 * @property {string} createdAt
 */

/**
 * GET /check-in/events
 * @typedef {object} ControllerEvent
 * @property {string} id
 * @property {string} title
 * @property {string} posterUrl
 * @property {{ id: string, startTime: string, venue: VenueRef }[]} sessions
 */

/**
 * POST /check-in
 * @typedef {object} CheckInResult
 * @property {string} ticketId
 * @property {string} usedAt
 * @property {{ id: string, title: string }} event
 * @property {string} startTime
 * @property {string} category
 * @property {SeatRef | null} seat
 */

export {};

/**
 * GET /admin/stats — har bir guruh: holat/rol → soni
 * @typedef {object} AdminStats
 * @property {Record<string, number>} users
 * @property {Record<string, number>} events
 * @property {Record<string, number>} applications
 * @property {Record<string, number>} orders
 * @property {Record<string, number>} tickets
 * @property {number} revenue  to'langan buyurtmalar summasi
 */

/**
 * GET /admin/events — element
 * @typedef {object} AdminEvent
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} posterUrl
 * @property {number | null} ageLimit
 * @property {number} duration
 * @property {EventStatus} status
 * @property {string | null} rejectReason
 * @property {string} createdAt
 * @property {{ id: string, fullName: string | null, email: string }} organizer
 * @property {{ sessions: number, images: number }} _count
 */

/** @typedef {{ items: AdminEvent[], meta: PageMeta }} AdminEventPage */

/**
 * GET /admin/organizerapplications — element
 * @typedef {OrganizerApplication & { reviewedAt: string | null, user: { id: string, fullName: string | null, email: string, role: Role } }} AdminApplication
 */

/**
 * GET /admin/users — element (xarid statistikasi faqat to'langan buyurtmalardan)
 * @typedef {object} AdminUser
 * @property {string} id
 * @property {string | null} fullName
 * @property {string} email
 * @property {string | null} phone
 * @property {Role} role
 * @property {'PENDING' | 'ACTIVE' | 'BLOCKED'} status
 * @property {boolean} isVerified
 * @property {string} createdAt
 * @property {number} tickets
 * @property {number} orders
 * @property {number} spent
 * @property {string | null} lastPurchaseAt
 * @property {string | null} lastActiveAt
 */

/** @typedef {{ items: AdminUser[], meta: PageMeta }} AdminUserPage */

/**
 * @typedef {object} AdminUserOrder
 * @property {string} id
 * @property {OrderStatus} status
 * @property {string} createdAt
 * @property {string | null} paidAt
 * @property {number} total
 * @property {{ startTime: string, venue: { name: string }, event: { id: string, title: string, posterUrl: string } }} session
 * @property {{ category: string, price: number, seat: { sector: string, row: number, number: number } | null, status: TicketStatus | null, usedAt: string | null }[]} tickets
 */

/**
 * GET /admin/users/:id
 * @typedef {object} AdminUserDetail
 * @property {string} id
 * @property {string | null} fullName
 * @property {string} email
 * @property {string | null} phone
 * @property {Role} role
 * @property {'PENDING' | 'ACTIVE' | 'BLOCKED'} status
 * @property {boolean} isVerified
 * @property {string} createdAt
 * @property {{ fullName: string | null, email: string } | null} createdBy
 * @property {{ device: string, lastActiveAt: string, createdAt: string }[]} devices
 * @property {{ companyName: string, status: ApplicationStatus, createdAt: string }[]} applications
 * @property {{ organizedEvents: number, checkedTickets: number }} _count
 * @property {{ tickets: number, orders: number, spent: number, used: number }} summary
 * @property {AdminUserOrder[]} orders
 */
