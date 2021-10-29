/* eslint-disable react/prop-types */
import { GoogleMap, Polygon, useJsApiLoader } from '@react-google-maps/api';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Territory from './Territory';
import { config } from '../../constants';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import queryString from 'query-string';
import { useLocation } from 'react-router';
import { useUserContext } from '../../contexts/UserContext';
import uuid from 'uuid';

const Territories = (props) => {
  const { currentUser } = useUserContext();
  const [territoryId, setTerritoryId] = useState();
  const [territoryName, setTerritoryName] = useState();
  const [territories, setTerritories] = useState([]);
  const [path, setPath] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [edit, setEdit] = useState(false);

  const handleUpdateMap = (e) => {
    e.preventDefault();
    console.log(path);
    const configObj = {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accepts: 'application/json',
      },
      body: JSON.stringify({ territory: { points: path } }),
    };
    fetch(
      `${config.url.API_URL}/congregations/${currentUser.congregation.id}/territories/${territoryId}`,
      configObj,
    )
      .then((r) => r.json())
      .then((d) => {
        setContactsLoaded(false);
        setEdit(false);
        polygonRef.current = new window.google.maps.Polygon({ paths: path });
        updateContacts(territoryId);
      });
  };

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: 'drawing',
  });

  const polygonRef = useRef(null);
  const listenersRef = useRef([]);

  // Call setPath with new edited path
  const onEdit = useCallback(() => {
    if (polygonRef.current) {
      const nextPath = polygonRef.current
        .getPath()
        .getArray()
        .map((latLng) => {
          return { lat: latLng.lat(), lng: latLng.lng() };
        });
      setPath(nextPath);
    }
  }, [setPath]);

  // Bind refs to current Polygon and listeners
  const onLoad = useCallback(
    (polygon) => {
      polygonRef.current = polygon;
      const path = polygon.getPath();
      listenersRef.current.push(
        path.addListener('set_at', onEdit),
        path.addListener('insert_at', onEdit),
        path.addListener('remove_at', onEdit),
      );
    },
    [onEdit],
  );

  // Clean up refs
  const onUnmount = useCallback(() => {
    listenersRef.current.forEach((lis) => lis.remove());
    polygonRef.current = null;
  }, []);

  useEffect(() => {
    fetch(`${config.url.API_URL}/congregations/${currentUser.congregation.id}/territories`)
      .then((r) => r.json())
      .then((data) => {
        setTerritories(data);
      });
  }, [currentUser.congregation.id]);

  const getCenter = (points) => {
    const lngCenter =
      points.reduce((sum, point) => {
        return sum + point.lng;
      }, 0) / points.length;

    const latCenter =
      points.reduce((sum, point) => {
        return sum + point.lat;
      }, 0) / points.length;

    return { lng: lngCenter, lat: latCenter };
  };

  const updateContacts = (territoryId) => {
    const url = currentUser.congregation.api_access
      ? `${config.url.API_URL}/congregations/${currentUser.congregation.id}/territories/${territoryId}/contacts`
      : `${config.url.API_URL}/congregations/${currentUser.congregation.id}/territories/${territoryId}/external_contacts`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setContacts(d);
        setContactsLoaded(true);
      });
  };

  const [dncs, setDncs] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const getTerritory = (id = territoryId) => {
    fetch(`${config.url.API_URL}/congregations/${currentUser.congregation.id}/territories/${id}`)
      .then((r) => {
        if (!r.ok) {
          throw r;
        }
        return r.json();
      })
      .then((d) => {
        setPath(d.points);
        setContactsLoaded(false);
        polygonRef.current = new window.google.maps.Polygon({ paths: d.points });
        setTerritoryName(d.name);
        setDncs(d.dncs);
        setAssignments(d.sorted_assignments);
        updateContacts(id);
      })
      .catch((e) => {
        console.log(e);
      });
  };

  const handleChange = (e) => {
    setTerritoryId(e.target.value);
    setContactsLoaded(false);
    getTerritory(e.target.value);
  };

  const location = useLocation();
  const territoryQuery = queryString.parse(location.search)['territory'];
  useEffect(() => {
    if (territoryQuery) {
      setTerritoryId(territoryQuery);
      setContactsLoaded(false);
      getTerritory(territoryQuery);
    }
  }, [territoryQuery]);

  const territoryOptions = territories
    .sort((a, b) => {
      return a.name < b.name ? -1 : 1;
    })
    .map((t) => (
      <option key={uuid()} value={t.id}>
        {t.name}
      </option>
    ));

  const containerStyle = {
    width: '100%',
    height: edit ? '1000px' : '400px',
  };

  return (
    <div>
      <h3>Select a Territory</h3>
      <select name="territoryId" onChange={handleChange} value={territoryId}>
        <option key={uuid()} value="0">
          Select a Territory
        </option>
        {territoryOptions}
      </select>
      {contactsLoaded ? (
        <>
          <br />
          <br />
          {edit ? (
            <button onClick={handleUpdateMap} className="btn btn-primary">
              Save Changes
            </button>
          ) : (
            <button onClick={() => setEdit(true)} className="btn btn-dark">
              Edit Borders
            </button>
          )}

          {isLoaded && (
            <GoogleMap
              zoom={14}
              mapContainerStyle={containerStyle}
              center={edit ? null : getCenter(path)}
            >
              <Polygon
                ref={polygonRef}
                paths={path}
                strokeColor="#0000FF"
                strokeOpacity={0.8}
                strokeWeight={2}
                fillColor="#0000FF"
                fillOpacity={0.35}
                onMouseUp={onEdit}
                onLoad={onLoad}
                onUnmount={onUnmount}
                editable={edit}
                options={{ fillColor: 'purple' }}
              />
            </GoogleMap>
          )}
          <Territory
            contacts={contacts}
            territoryName={territoryName}
            dncs={dncs}
            assignments={assignments}
            territoryId={territoryId}
            currentUser={currentUser}
            refreshTerritory={getTerritory}
          />
        </>
      ) : territoryId > 0 ? (
        <>
          <br />
          <br />
          <FontAwesomeIcon icon={faSpinner} size="6x" spin />
        </>
      ) : null}
    </div>
  );
};

export default Territories;
