-- Service payments: records every x402 payment for an agent's service
create table if not exists service_payments (
  id            text primary key,
  service_id    text not null references services(id),
  agent_id      text not null references agents(id),
  payer_address text not null,
  tx_hash       text unique,
  amount        text not null,
  token         text not null default 'USDC',
  network       text not null default 'eip155:8453',
  status        text not null default 'confirmed' check (status in ('confirmed', 'pending', 'failed')),
  created_at    timestamptz default now()
);

create index idx_service_payments_service on service_payments(service_id);
create index idx_service_payments_agent on service_payments(agent_id);
create index idx_service_payments_payer on service_payments(payer_address);
