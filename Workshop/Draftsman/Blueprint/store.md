# Store Blueprint

Purpose:
- Define a /store command to display items, prices, and purchase links for an in-bot store.

Inputs:
- item_id (optional)
- category (optional)

Outputs:
- Paginated list card or item detail card

Acceptance criteria:
- Sanitizes external URLs and protects against malicious content

Implementation notes:
- Keep product catalog in a managed JSON file with versioning
