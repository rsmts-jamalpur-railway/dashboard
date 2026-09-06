'use client';
import React, { useState, useMemo } from 'react';
import { FiMapPin, FiSearch, FiChevronDown, FiX } from 'react-icons/fi';

export interface LocationItem {
  location_id: string;
  location_type?: string;
  max_capacity?: number;
  zone?: string;
  current_occupancy?: number;
}

interface LocationSelectorProps {
  locations: LocationItem[];
  selectedLocation: string;
  onSelect: (locationId: string) => void;
}

export default function LocationSelector({
  locations,
  selectedLocation,
  onSelect,
}: LocationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Group locations hierarchically
  const groupedLocations = useMemo(() => {
    const groups: Record<string, LocationItem[]> = {
      'Operational Repair Shops': [],
      'Manufacturing Shops': [],
      'Quality Assurance': [],
      'Primary Yards': [],
      'Specialty Lines': [],
      'Yard Lines (1–56)': [],
    };

    locations.forEach((loc) => {
      const id = loc.location_id;
      if (['WRS-1', 'WRS-2', 'WRS-3', 'WRS-4', 'DPS'].includes(id)) {
        groups['Operational Repair Shops'].push(loc);
      } else if (['GIF', 'CRANE'].includes(id)) {
        groups['Manufacturing Shops'].push(loc);
      } else if (['WRS-5'].includes(id)) {
        groups['Quality Assurance'].push(loc);
      } else if (['NSY', 'Exit Yard', 'Trial Yard'].includes(id)) {
        groups['Primary Yards'].push(loc);
      } else if (['Tower Car Line', 'Wheel Park Line'].includes(id)) {
        groups['Specialty Lines'].push(loc);
      } else if (id.startsWith('Line-') || id.startsWith('Line ')) {
        groups['Yard Lines (1–56)'].push(loc);
      } else {
        if (!groups['Other Workshop Nodes']) groups['Other Workshop Nodes'] = [];
        groups['Other Workshop Nodes'].push(loc);
      }
    });

    return groups;
  }, [locations]);

  // Filter based on search query
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groupedLocations;
    const q = search.toLowerCase();
    const result: Record<string, LocationItem[]> = {};

    Object.entries(groupedLocations).forEach(([groupName, items]) => {
      const filtered = items.filter(
        (loc) =>
          loc.location_id.toLowerCase().includes(q) ||
          (loc.zone && loc.zone.toLowerCase().includes(q))
      );
      if (filtered.length > 0) {
        result[groupName] = filtered;
      }
    });

    return result;
  }, [groupedLocations, search]);

  const selectedLocData = locations.find((l) => l.location_id === selectedLocation);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #D1D5DB',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 500,
          color: selectedLocation === 'ALL' ? '#374151' : '#0A74DA',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <FiMapPin size={13} style={{ color: selectedLocation === 'ALL' ? '#6B7280' : '#0A74DA' }} />
        <span>
          {selectedLocation === 'ALL'
            ? 'All 68 Locations'
            : `${selectedLocation} (${selectedLocData?.current_occupancy || 0})`}
        </span>
        <FiChevronDown size={12} style={{ color: '#9CA3AF' }} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            width: '320px',
            maxHeight: '420px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #111827',
            borderRadius: '4px',
            boxShadow: 'none',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Search Header */}
          <div
            style={{
              padding: '8px',
              borderBottom: '1px solid #E5E7EB',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FiSearch size={14} style={{ color: '#6B7280' }} />
            <input
              type="text"
              placeholder="Search 68 locations & lines..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              style={{
                border: 'none',
                outline: 'none',
                width: '100%',
                fontSize: '12px',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <FiX size={12} color="#9CA3AF" />
              </button>
            )}
          </div>

          {/* Quick Option: All Locations */}
          <div
            onClick={() => {
              onSelect('ALL');
              setIsOpen(false);
            }}
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: selectedLocation === 'ALL' ? '#F3F4F6' : '#FFFFFF',
              borderBottom: '1px solid #E5E7EB',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>🌐 All 68 Locations (Workshop Global)</span>
            <span style={{ fontSize: '11px', color: '#6B7280' }}>Total {locations.length || 68}</span>
          </div>

          {/* Scrollable Groups */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            {Object.entries(filteredGroups).map(([groupTitle, items]) => (
              <div key={groupTitle} style={{ marginBottom: '8px' }}>
                <div
                  style={{
                    padding: '4px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#6B7280',
                    backgroundColor: '#F9FAFB',
                    borderBottom: '1px solid #F3F4F6',
                    letterSpacing: '0.04em',
                  }}
                >
                  {groupTitle} ({items.length})
                </div>

                {items.map((loc) => {
                  const isSelected = selectedLocation === loc.location_id;
                  const occ = loc.current_occupancy || 0;
                  const max = loc.max_capacity || 50;
                  const isFull = occ >= max;

                  return (
                    <div
                      key={loc.location_id}
                      onClick={() => {
                        onSelect(loc.location_id);
                        setIsOpen(false);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                        borderLeft: isSelected ? '3px solid #0A74DA' : '3px solid transparent',
                      }}
                    >
                      <span style={{ fontWeight: isSelected ? 600 : 400 }}>{loc.location_id}</span>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '2px',
                          backgroundColor: isFull ? '#FEE2E2' : occ > 0 ? '#E0F2FE' : '#F3F4F6',
                          color: isFull ? '#DC2626' : occ > 0 ? '#0369A1' : '#6B7280',
                          fontWeight: 500,
                        }}
                      >
                        {occ}/{max}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}

            {Object.keys(filteredGroups).length === 0 && (
              <div style={{ padding: '16px', fontSize: '12px', color: '#9CA3AF', textAlign: 'center' }}>
                No locations match &quot;{search}&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
