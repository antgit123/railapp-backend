// packages/api-client/src/msw/handlers/index.ts
// Backend Agent — Week 1 Deliverable
// Ticket: RAIL-008
// MSW fixtures for all 8 All Aboard API operations — used in Jest + Playwright

import { graphql, HttpResponse } from 'msw';

// ─── Fixture Data ──────────────────────────────────────────────────────────

const JOURNEY_FIXTURE = {
  id: 'journey-london-paris-001',
  itinerary: {
    duration: 'PT2H15M',
    stops: [
      { name: 'London St Pancras', arrival: null, departure: '2026-06-15T09:00:00Z', platform: '3' },
      { name: 'Paris Gare du Nord', arrival: '2026-06-15T12:15:00Z', departure: null, platform: '18' },
    ],
    legs: [{
      origin: { name: 'London St Pancras', code: 'STP' },
      destination: { name: 'Paris Gare du Nord', code: 'PAD' },
      departure: '2026-06-15T09:00:00Z',
      arrival: '2026-06-15T12:15:00Z',
      duration: 'PT2H15M',
      operator: { name: 'Eurostar', logo: 'https://cdn.example.com/eurostar.svg' },
      serviceClass: 'STANDARD',
      trainNumber: 'ES9014',
    }],
  },
};

const OFFER_FIXTURE = {
  itinerary: {
    offers: [
      {
        id: 'offer-standard-001',
        price: { amount: 4900, currency: 'GBP' },  // pence
        fareType: 'NON_FLEXIBLE',
        serviceClass: 'STANDARD',
        availabilityStatus: 'AVAILABLE',
      },
      {
        id: 'offer-first-001',
        price: { amount: 9900, currency: 'GBP' },
        fareType: 'NON_FLEXIBLE',
        serviceClass: 'FIRST',
        availabilityStatus: 'AVAILABLE',
      },
      {
        id: 'offer-flexible-001',
        price: { amount: 15900, currency: 'GBP' },
        fareType: 'FLEXIBLE',
        serviceClass: 'STANDARD',
        availabilityStatus: 'AVAILABLE',
      },
    ],
  },
};

const BOOKING_FIXTURE = {
  id: 'booking-abc123',
  status: 'PENDING',
  expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(), // 20 min from now
  requirements: {
    passengers: [{ type: 'ADULT', requiresDateOfBirth: false, requiresNationality: false }],
  },
};

const ORDER_FIXTURE = {
  id: 'order-xyz789',
  status: 'AWAITING_PAYMENT',
  totalPrice: { amount: 4900, currency: 'GBP' },
};

const FINALIZED_ORDER_FIXTURE = {
  id: 'order-xyz789',
  status: 'CONFIRMED',
  ticketIssuanceStatus: 'ISSUED',
};

const TICKET_FIXTURE = {
  id: 'order-xyz789',
  items: [{
    id: 'item-001',
    resources: [{
      __typename: 'PdfTicket',
      url: 'https://s3.amazonaws.com/railbook/tickets/ticket-001.pdf',
    }],
  }],
};

const RAIL_PASSES_FIXTURE = {
  bundles: [
    {
      id: 'eurail-global-7day',
      name: 'Eurail Global Pass — 7 Days',
      zones: ['GLOBAL'],
      validityDays: 7,
      validityPeriodDays: 30,
      price: { amount: 27900, currency: 'EUR' },
      class: 'SECOND',
    },
    {
      id: 'eurail-global-10day',
      name: 'Eurail Global Pass — 10 Days',
      zones: ['GLOBAL'],
      validityDays: 10,
      validityPeriodDays: 60,
      price: { amount: 35900, currency: 'EUR' },
      class: 'SECOND',
    },
  ],
};

// ─── MSW Handlers ─────────────────────────────────────────────────────────

export const allAboardHandlers = [

  // 1. GetJourneys
  graphql.query('GetJourneys', ({ variables }) => {
    // Simulate empty results for unknown routes
    if (variables.origin === 'UNKNOWN' || variables.destination === 'UNKNOWN') {
      return HttpResponse.json({ data: { journeys: [] } });
    }
    // Simulate rate limit for specific test cases
    if (variables.origin === 'RATE_LIMIT_TEST') {
      return HttpResponse.json({
        errors: [{ message: 'Rate limit exceeded', extensions: { code: 'RATE_LIMITED' } }],
      }, { status: 429 });
    }
    return HttpResponse.json({ data: { journeys: [JOURNEY_FIXTURE] } });
  }),

  // 2. GetJourneyOffer (subscription — mocked as query for MSW)
  graphql.query('GetJourneyOffer', ({ variables }) => {
    if (variables.journey === 'expired-journey') {
      return HttpResponse.json({
        errors: [{ message: 'Offer not available', extensions: { code: 'OFFER_NOT_AVAILABLE' } }],
      });
    }
    return HttpResponse.json({ data: { journeyOffer: OFFER_FIXTURE } });
  }),

  // 3. CreateBooking
  graphql.mutation('CreateBooking', ({ variables }) => {
    if (variables.offerIds?.includes('offer-unavailable')) {
      return HttpResponse.json({
        errors: [{ message: 'Offer no longer available', extensions: { code: 'OFFER_NOT_AVAILABLE' } }],
      });
    }
    return HttpResponse.json({ data: { createBooking: BOOKING_FIXTURE } });
  }),

  // 4. CreateOrder
  graphql.mutation('CreateOrder', () =>
    HttpResponse.json({ data: { createOrder: ORDER_FIXTURE } })
  ),

  // 5. FinalizeOrder
  graphql.mutation('FinalizeOrder', ({ variables }) => {
    if (variables.order === 'payment-failed-order') {
      return HttpResponse.json({
        errors: [{ message: 'Payment failed', extensions: { code: 'PAYMENT_FAILED' } }],
      });
    }
    return HttpResponse.json({ data: { finalizeOrder: FINALIZED_ORDER_FIXTURE } });
  }),

  // 6. GetTickets (node query)
  graphql.query('GetOrder', () =>
    HttpResponse.json({ data: { node: TICKET_FIXTURE } })
  ),

  // 7. RefundEligibility + ProcessRefund
  graphql.mutation('ProcessRefund', () =>
    HttpResponse.json({
      data: {
        refundEligibility: { eligible: true, amount: { amount: 4900, currency: 'GBP' } },
        processRefund: { id: 'refund-001', status: 'PROCESSED', amount: { amount: 4900, currency: 'GBP' } },
      },
    })
  ),

  // 8. GetRailPasses
  graphql.query('GetRailPasses', () =>
    HttpResponse.json({ data: { bundles: RAIL_PASSES_FIXTURE.bundles } })
  ),
];

// ─── MSW Server (Node — Jest) ──────────────────────────────────────────────
export { allAboardHandlers as handlers };
