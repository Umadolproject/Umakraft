# Delivery

Purpose
- Describe the transport layer (Courier) responsible for delivering Miner envelopes to the Inspector.

Responsibilities
- Validate miner envelope shape before delivery
- Passthrough Miner failure envelopes unchanged
- Measure delivery time and log transport events
- Return Inspector result or a transport-error envelope

Failure handling
- On transient transport failures return retriable error envelope (retriable: true)
- Do not re-attempt inspection in Courier — let caller decide retry policy

Implementation
- See umamoe/Courier/courier.js for validateTransportability() and transport() implementation.
- Courier logs as INFO/WARN/ERROR and preserves original input in transport error context.
