import React, { useState } from 'react';
import { Marker, Popup } from 'react-map-gl';
import { eventsData } from './eventsData';

const EventMarkers = () => {
    const [selectedEvent, setSelectedEvent] = useState(null);

    const getIcon = (type) => {
        switch(type) {
            case 'food': return '🥞';
            case 'tech': return '💻';
            case 'music': return '🎵';
            case 'sports': return '🏎️';
            case 'social': return '🎈';
            default: return '🎉';
        }
    };

    return (
        <>
            {eventsData.map(event => (
                <Marker
                    key={event.id}
                    longitude={event.longitude}
                    latitude={event.latitude}
                    anchor="bottom"
                    onClick={e => {
                        // Prevent clicking through to map
                        e.originalEvent.stopPropagation();
                        setSelectedEvent(event);
                    }}
                >
                    <div style={{
                        fontSize: '30px', 
                        cursor: 'pointer',
                        filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))',
                        transform: 'scale(1)',
                        transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)' // bouncier transition
                    }}
                    onMouseOver={e => e.currentTarget.style.transform = 'scale(1.4)'}
                    onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        {getIcon(event.type)}
                    </div>
                </Marker>
            ))}

            {selectedEvent && (
                <Popup
                    longitude={selectedEvent.longitude}
                    latitude={selectedEvent.latitude}
                    anchor="top"
                    onClose={() => setSelectedEvent(null)}
                    closeOnClick={false}
                    maxWidth="300px"
                >
                    <div style={{ padding: '8px' }}>
                        <h3 style={{ margin: '0 0 6px', color: '#C41230', display: 'flex', alignItems: 'center' }}>
                            <span style={{ marginRight: '8px', fontSize: '20px' }}>{getIcon(selectedEvent.type)}</span>
                            {selectedEvent.name}
                        </h3>
                        <p style={{ margin: '0 0 5px', fontSize: '13px', fontWeight: 'bold' }}>📍 {selectedEvent.location}</p>
                        <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#555' }}>⏰ {selectedEvent.time}</p>
                        <p style={{ margin: '0', fontSize: '14px', lineHeight: '1.4' }}>{selectedEvent.description}</p>
                    </div>
                </Popup>
            )}
        </>
    );
};

export default EventMarkers;
