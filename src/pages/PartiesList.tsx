import { useEffect, useState, useMemo } from 'react';
import { getParties, saveParty, deleteParty, getDispatches, getPayments } from '../lib/db';
import type { Party, Dispatch, Payment } from '../types';
import { calculatePartyBalance } from '../utils/calculations';
import { playPopSound, triggerConfetti } from '../utils/delight';
import { useLedgerListener } from '../hooks/useLedgerListener';
import { v4 as uuidv4 } from 'uuid';
import {
  UserPlus,
  Trash2,
  ChevronRight,
  Building2,
  Search,
  X,
  List,
  LayoutGrid,
  Phone,
  PhoneCall
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PartyModalSheet from '../components/PartyModalSheet';
import PartyGlyph from '../components/PartyGlyph';
import IOSConfirmModal from '../components/IOSConfirmModal';

export default function PartiesList() {
  const [parties, setParties] = useState<Party[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Persistent List / Grid view state
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    return (localStorage.getItem('parties_view_mode') as 'list' | 'grid') || 'list';
  });

  const navigate = useNavigate();

  const refreshData = async () => {
    const [p, d, pay] = await Promise.all([getParties(), getDispatches(), getPayments()]);
    setParties(p);
    setDispatches(d);
    setPayments(pay);
  };

  useEffect(() => {
    let current = true;
    Promise.all([getParties(), getDispatches(), getPayments()]).then(([p, d, pay]) => {
      if (current) {
        setParties(p);
        setDispatches(d);
        setPayments(pay);
        setLoading(false);
      }
    });
    return () => {
      current = false;
    };
  }, []);

  useLedgerListener(() => {
    refreshData();
  });

  const [partyToDelete, setPartyToDelete] = useState<Party | null>(null);

  const handleViewModeChange = (mode: 'list' | 'grid') => {
    setViewMode(mode);
    localStorage.setItem('parties_view_mode', mode);
  };

  const handleDelete = (e: React.MouseEvent, party: Party) => {
    e.stopPropagation();
    playPopSound();
    setPartyToDelete(party);
  };

  const handleConfirmDeleteParty = async () => {
    if (!partyToDelete) return;
    await deleteParty(partyToDelete.id);
    setPartyToDelete(null);
    refreshData();
  };

  // Filter parties by search and category
  const filteredParties = useMemo(() => {
    return parties.filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.contactPerson?.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      return true;
    });
  }, [parties, searchQuery]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--label-secondary)', fontSize: 15 }}>
        Loading parties…
      </div>
    );
  }

  return (
    <div className="ios-fade-in" style={{ paddingBottom: 32 }}>
      {/* ── iOS Navigation Header with Large Title ── */}
      <div className="ios-large-header">
        <div className="ios-large-subtitle">{parties.length} ACCOUNTS</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className="ios-large-title">Parties</h1>
        </div>
      </div>

      {/* ── Big Luxury Add New Party Button ── */}
      <div style={{ padding: '4px 16px 14px' }}>
        <button
          onClick={() => {
            playPopSound();
            setIsAdding(true);
          }}
          style={{
            width: '100%',
            height: 52,
            borderRadius: 16,
            background: 'var(--ios-blue)',
            color: '#FFFFFF',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: 'none',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="ios-btn-primary"
        >
          <UserPlus style={{ width: 20, height: 20 }} strokeWidth={2.6} />
          <span>Add New Party</span>
        </button>
      </div>

      {/* ── iOS Search Bar ── */}
      <div className="ios-search-container" style={{ padding: '0 16px 12px' }}>
        <div className="ios-search-bar" style={{
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)',
          border: '1px solid var(--border-glass)',
          background: 'var(--fill-tertiary)'
        }}>
          <Search style={{ width: 17, height: 17, color: 'var(--label-tertiary)' }} strokeWidth={2.4} />
          <input
            type="text"
            placeholder="Search factories, contacts, city…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ios-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                playPopSound();
              }}
              style={{
                background: 'var(--fill-primary)',
                border: 'none',
                borderRadius: '50%',
                width: 20,
                height: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--label-secondary)',
                cursor: 'pointer',
                padding: 0
              }}
            >
              <X style={{ width: 12, height: 12 }} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* ── Categories & Persistent View Switcher Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px 14px',
          gap: 10
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--label-secondary)' }}>
          {filteredParties.length} {filteredParties.length === 1 ? 'account' : 'accounts'}
        </span>

        {/* Persistent List vs Grid Switcher */}
        <div
          style={{
            display: 'flex',
            background: 'var(--fill-primary)',
            padding: 3,
            borderRadius: 10,
            gap: 2,
            flexShrink: 0
          }}
        >
          <button
            onClick={() => {
              playPopSound();
              handleViewModeChange('list');
            }}
            title="List View"
            style={{
              border: 'none',
              background: viewMode === 'list' ? 'var(--bg-card)' : 'transparent',
              color: viewMode === 'list' ? 'var(--label-primary)' : 'var(--label-tertiary)',
              padding: '5px 8px',
              borderRadius: 7,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: viewMode === 'list' ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <List style={{ width: 17, height: 17 }} strokeWidth={2.4} />
          </button>

          <button
            onClick={() => {
              playPopSound();
              handleViewModeChange('grid');
            }}
            title="Grid View"
            style={{
              border: 'none',
              background: viewMode === 'grid' ? 'var(--bg-card)' : 'transparent',
              color: viewMode === 'grid' ? 'var(--label-primary)' : 'var(--label-tertiary)',
              padding: '5px 8px',
              borderRadius: 7,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: viewMode === 'grid' ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <LayoutGrid style={{ width: 17, height: 17 }} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      {/* ── View 1: List View (Apple Grouped Inset) ── */}
      {viewMode === 'list' && (
        <div className="ios-group">
          <div className="ios-card-grouped">
            {filteredParties.length === 0 ? (
              <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--label-secondary)' }}>
                <Building2 style={{ width: 40, height: 40, margin: '0 auto 8px', opacity: 0.35 }} strokeWidth={1.5} />
                <div style={{ fontSize: 16, fontWeight: 600 }}>
                  {searchQuery ? 'No Matching Parties' : 'No Parties Yet'}
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  {searchQuery ? 'Try a different search query' : 'Tap "+ Add New Party" above to add your first client.'}
                </div>
              </div>
            ) : (
              filteredParties.map((party, i) => {
                const partyDispatches = dispatches.filter((d) => d.partyId === party.id);
                const partyPayments = payments.filter((p) => p.partyId === party.id);
                const balanceResult = calculatePartyBalance(partyDispatches, partyPayments);
                const partyProfit = balanceResult.totalProfit;
                const outstandingBalance = balanceResult.outstandingBalance;
                const isCleared = balanceResult.isCleared;

                return (
                  <div
                    key={party.id}
                    className="ios-cell"
                    onClick={() => {
                      playPopSound();
                      navigate(`/parties/${party.id}`);
                    }}
                    style={{
                      padding: '16px 16px',
                      alignItems: 'flex-start',
                      display: 'flex',
                      position: 'relative',
                      cursor: 'pointer'
                    }}
                  >
                    {/* Authentic Apple iOS Business Glyph */}
                    <PartyGlyph
                      name={party.name}
                      size={42}
                      borderRadius={11}
                      iconSize={20}
                      style={{ marginRight: 13, marginTop: 2 }}
                    />

                    {/* Party Information */}
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
                      {/* Row 1: Party Name & Contact with Top Actions */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 700,
                              color: 'var(--label-primary)',
                              lineHeight: 1.25,
                              letterSpacing: -0.2
                            }}
                          >
                            {party.name}
                          </div>
                          <div
                            style={{
                              fontSize: 12.5,
                              color: 'var(--label-secondary)',
                              marginTop: 3,
                              lineHeight: 1.3,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {party.contactPerson ? `${party.contactPerson} · ` : ''}{party.phone || party.address || 'No phone added'}
                          </div>
                        </div>

                        {/* Top Actions: Delete + Chevron */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, marginTop: -2 }}>
                          <button
                            onClick={(e) => handleDelete(e, party)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 6,
                              color: 'var(--label-tertiary)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 8
                            }}
                            title="Delete Party"
                          >
                            <Trash2 style={{ width: 16, height: 16 }} />
                          </button>
                          <ChevronRight className="ios-chevron" style={{ width: 16, height: 16 }} strokeWidth={2.5} />
                        </div>
                      </div>

                      {/* Row 2: Outstanding / Advance Balance Pill + Quick Call Button */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
                        {isCleared ? (
                          <span style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'white',
                            background: 'var(--ios-green)',
                            padding: '3px 9px',
                            borderRadius: 7,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            <span className="pulse-dot green" /> Settled
                          </span>
                        ) : outstandingBalance > 0 ? (
                          <span style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'white',
                            background: 'var(--ios-orange)',
                            padding: '3px 9px',
                            borderRadius: 7,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }} className="tabular-nums">
                            <span className="pulse-dot orange" /> Due Rs.&nbsp;{outstandingBalance.toLocaleString('en-PK')}
                          </span>
                        ) : outstandingBalance < 0 ? (
                          <span style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'white',
                            background: 'var(--ios-blue)',
                            padding: '3px 9px',
                            borderRadius: 7,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }} className="tabular-nums">
                            <span className="pulse-dot blue" /> Adv Rs.&nbsp;{Math.abs(outstandingBalance).toLocaleString('en-PK')}
                          </span>
                        ) : (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--label-tertiary)',
                            background: 'var(--fill-tertiary)',
                            padding: '2px 8px',
                            borderRadius: 6,
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            No Ledger
                          </span>
                        )}

                        {/* Quick Call Action */}
                        {party.phone && (
                          <a
                            href={`tel:${party.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: 'white',
                              background: 'var(--ios-green)',
                              padding: '3px 9px',
                              borderRadius: 7,
                              textDecoration: 'none',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}
                            title={`Call ${party.phone}`}
                          >
                            <PhoneCall style={{ width: 11, height: 11 }} />
                            <span>Call</span>
                          </a>
                        )}
                      </div>

                      {/* Row 3: Operational Metrics (Dispatches & Net Profit) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'white',
                            background: 'black',
                            padding: '2px 8px',
                            borderRadius: 6,
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}
                        >
                          {partyDispatches.length} {partyDispatches.length === 1 ? 'Dispatch' : 'Dispatches'}
                        </span>

                        {partyProfit > 0 && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: 'white',
                              background: 'var(--ios-green)',
                              padding: '2px 8px',
                              borderRadius: 6,
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}
                            className="tabular-nums"
                          >
                            +Rs.&nbsp;{Math.round(partyProfit).toLocaleString('en-PK')}&nbsp;Profit
                          </span>
                        )}
                      </div>
                    </div>

                    {i < filteredParties.length - 1 && <div className="ios-separator with-glyph" style={{ left: 71 }} />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── View 2: Grid View (Apple 2-Column Cards) ── */}
      {viewMode === 'grid' && (
        <div style={{ padding: '0 16px' }}>
          {filteredParties.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--label-secondary)' }}>
              <Building2 style={{ width: 40, height: 40, margin: '0 auto 8px', opacity: 0.35 }} strokeWidth={1.5} />
              <div style={{ fontSize: 16, fontWeight: 500 }}>No Parties Found</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {filteredParties.map((party) => {
                const partyDispatches = dispatches.filter((d) => d.partyId === party.id);
                const partyPayments = payments.filter((p) => p.partyId === party.id);
                const balanceResult = calculatePartyBalance(partyDispatches, partyPayments);
                const partyProfit = balanceResult.totalProfit;
                const outstandingBalance = balanceResult.outstandingBalance;
                const isCleared = balanceResult.isCleared;

                return (
                  <div
                    key={party.id}
                    onClick={() => {
                      playPopSound();
                      navigate(`/parties/${party.id}`);
                    }}
                    style={{
                      background: 'var(--bg-card)',
                      borderRadius: 18,
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: 160,
                      boxShadow: 'var(--shadow-card)',
                      border: '1px solid var(--border-glass)',
                      cursor: 'pointer',
                      transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                      position: 'relative',
                      backdropFilter: 'blur(16px)'
                    }}
                    className="ios-metric-widget"
                  >
                    <div>
                      {/* Top Header: Business Glyph & Call */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <PartyGlyph
                          name={party.name}
                          size={36}
                          borderRadius={10}
                          iconSize={18}
                        />

                        {party.phone && (
                          <a
                            href={`tel:${party.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: 'var(--ios-green)',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textDecoration: 'none'
                            }}
                            title={`Call ${party.phone}`}
                          >
                            <Phone style={{ width: 13, height: 13 }} />
                          </a>
                        )}
                      </div>

                      {/* Party Name */}
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: 'var(--label-primary)',
                          lineHeight: 1.25,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}
                      >
                        {party.name}
                      </div>

                      {/* Contact / Phone */}
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--label-secondary)',
                          marginTop: 4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {party.contactPerson || party.phone || 'Industrial Plant'}
                      </div>
                    </div>

                    {/* Bottom Status Pill */}
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '0.5px solid var(--separator)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, color: 'var(--label-tertiary)', fontWeight: 500 }}>
                          {partyDispatches.length} {partyDispatches.length === 1 ? 'truck' : 'trucks'}
                        </span>

                        {partyProfit > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ios-green)' }} className="tabular-nums">
                            +{(partyProfit / 1000).toFixed(0)}k
                          </span>
                        )}
                      </div>

                      <div>
                        {isCleared ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ios-green)', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                            <span className="pulse-dot green" /> Settled
                          </span>
                        ) : outstandingBalance > 0 ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'white', background: 'var(--ios-orange)', padding: '3px 9px', borderRadius: 7, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }} className="tabular-nums">
                            <span className="pulse-dot orange" /> Due:&nbsp;Rs.&nbsp;{outstandingBalance.toLocaleString('en-PK')}
                          </span>
                        ) : outstandingBalance < 0 ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'white', background: 'var(--ios-blue)', padding: '3px 9px', borderRadius: 7, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }} className="tabular-nums">
                            <span className="pulse-dot blue" /> Adv:&nbsp;Rs.&nbsp;{Math.abs(outstandingBalance).toLocaleString('en-PK')}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--label-tertiary)', whiteSpace: 'nowrap' }}>No ledger</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Add Party Apple iOS Modal Sheet ── */}
      <PartyModalSheet
        isOpen={isAdding}
        mode="add"
        onClose={() => setIsAdding(false)}
        onSave={async (data) => {
          const party: Party = {
            id: uuidv4(),
            name: data.name,
            contactPerson: data.contactPerson,
            phone: data.phone,
            address: data.address,
            createdAt: Date.now()
          };
          await saveParty(party);
          triggerConfetti();
          setIsAdding(false);
          refreshData();
        }}
      />

      {/* ── iOS Liquid Glass Delete Confirmation Modal ── */}
      <IOSConfirmModal
        isOpen={Boolean(partyToDelete)}
        title="Delete Party?"
        message={`Are you sure you want to delete "${partyToDelete?.name}"? All related dispatches and ledger records will be unlinked.`}
        confirmText="Delete Party"
        cancelText="Cancel"
        destructive
        countdownSeconds={2}
        onConfirm={handleConfirmDeleteParty}
        onCancel={() => setPartyToDelete(null)}
      />
    </div>
  );
}
