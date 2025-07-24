import React, { useEffect, useState } from 'react';
import Button from 'react-bootstrap/Button';

import Accordion from 'react-bootstrap/Accordion';

import './settingsPanel.css';

import Modal from 'react-bootstrap/Modal';

const SettingsPanel = React.memo((props) => {
  console.log("Settings Data: ", props.machineData);
  
  const [checkedPlants, setCheckedPlants] = useState([]);
  
  async function addMission(name, action, hour, minute) {
    console.log("Adding Mission: ", action, hour, minute);
  
    if (props.sendCommand) {
      try{
        while (true){
        var mission_id = Math.floor(Math.random() * (1500 - 1) + 1);
        console.log("Mission ID: ", mission_id);
        console.log("Current Missions: ", props.machineData);
        if (!Object.values(props.machineData.missions).some(mission => mission.id === mission_id)) {
          console.log("Found a unique ID for mission");
          break; // Found a unique ID
        }
      }
      await props.sendCommand(`CHA,12,${name},${hour},${minute},${action},${mission_id}`);

      const newMachineData = {
        ...props.machineData,
        missions: [
          ...props.machineData.missions,
          {
            'mission_id': mission_id,
            'mission_name': name,
            'type': action,
            'time': [hour, minute],
            'locations': []
          }
        ]
      }

      props.setMachineData(newMachineData);
      document.getElementById('mission_name').value = '';
      document.getElementById('action').value = '';
      document.getElementById('hour').value = '';
      document.getElementById('minute').value = '';
      //TODO añadir en el farmData
      } catch (error) {
        console.error("Error adding mission:", error);
        alert("Failed to add mission. Please try again.");
      }
    }
  }

  const PlantSelectionPanel = ({mission_index}) => {
    const [showModal, setShowModal] = useState(false);
    const [selectedPlants, setSelectedPlants] = useState([]);
    // Return a modal with a list of plants to select from
    // plants present in the mission are checked
    // show modal when button is pressed
    
    useEffect(() => {
      if (props.machineData.missions) {
        setSelectedPlants(props.machineData.missions[mission_index].locations);
      }
    }, [showModal]); 

    const handleCheckboxChange = (event) => {
      const plant = event.target.value;
      console.log(plant);
      // get plant id from props.machineData.plants
      let plant_id = props.machineData.plants[plant].id;
      console.log("Plant ID: ", plant_id);
      console.log("Plant: ", plant_id);
      let target_checked = 1;
      if (event.target.checked) {
        target_checked = 0;
      }
      props.sendCommand(`CHA, 10, ${plant_id}, ${props.machineData.missions[mission_index].mission_id}, ${target_checked}`);

      

      const updatedMissions = [...props.machineData.missions];
      //Adding plant to mission
      if (event.target.checked) {
        if (updatedMissions[mission_index].locations.includes(plant)) {
          console.log("Plant already selected, not adding again");
        } else {
          updatedMissions[mission_index] = {
            ...updatedMissions[mission_index],
            locations: [...updatedMissions[mission_index].locations, plant]
          };
        }

      //Removing plant from mission
      } else {
        if (!updatedMissions[mission_index].locations.includes(plant)) {
          console.log("Plant not selected, not removing");
        } else {
          updatedMissions[mission_index] = {
            ...updatedMissions[mission_index],
            locations: updatedMissions[mission_index].locations.filter(
              location => location !== plant
            )
          };
        }
      }

      const newMachineData = {
        ...props.machineData,
        missions: updatedMissions
      };

      props.setMachineData(newMachineData);

    }

    return (
      <>
      <Button
        variant="outline-light"
        onClick={() => setShowModal(true)}
      >
        Select Plants
      </Button>
      <Modal
        show={showModal}
        onHide={() => {
          setShowModal(false);
          //props.sendData(new Uint8Array([0]));      
        }}
        centered
        style={{ zIndex: 9999 }}
        dialogClassName="modal-on-top"
      >
        <Modal.Header closeButton>
          <Modal.Title>Select Plants for mission: {props.machineData.missions[mission_index].mission_name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {props.machineData.plants ? (
            Object.keys(props.machineData.plants).map((plant, index) => (
              <div
                className="checkbox-container"
                key={index}
                style={{
                  color: 'black',
                }}
              >
                <input
                  type="checkbox"
                  id={`plant-${index}`}
                  name={plant}
                  value={plant}
                  checked={selectedPlants.includes(plant)}
                  onChange={handleCheckboxChange}
                  style={{
                    color: 'black',
                  }}
                />
                <label
                  htmlFor={`plant-${index}`}
                  style={{
                    color: 'black',
                  }}
                  >{plant}</label>
              </div>
            ))
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowModal(false);
              props.sendData(new Uint8Array([0]));      
            }}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
      </>
     
    );
  } 

  return (
    <div
      className="scrollable-panel"
      style={{
        display: 'flex',
        width: '300px',
        flexDirection: 'column',
        justifyContent: 'left',
        alignItems: 'left',
        color: 'white',
        passing: '10px',
        margin: '10px',
        height: '400px', // Set a fixed height
        overflowY: 'auto', // Make the panel scrollable vertically
        overflowX: 'hidden',
      }}
    >
    <Accordion defaultActiveKey="0">
      {props.machineData.missions ? (
        props.machineData.missions.map((mission, index) => (
          <Accordion.Item eventKey={index} key={mission.mission_id}>
            <Accordion.Header>
              {mission.mission_name}
            </Accordion.Header>
            <Accordion.Body>
              <table
                style={{
                  width: '100%',
                }}
              >
                <tbody>
                  <tr>
                    <th className='data-cell'>Hour:</th>
                    <td className='data-cell-right'> {mission.time[0]} </td>
                  </tr>
                  <tr>
                    <th className='data-cell'>Minute:</th>
                    <td className='data-cell-right'> {mission.time[1]} </td>
                  </tr>
                  <tr>
                    <th className='data-cell'>Action:</th>
                    <td className='data-cell-right'> {mission.type} </td>
                  </tr>
                </tbody>
              </table>

              <table
                style={{
                  width: '100%',
                }}
              >
                <tbody>
                  <tr>
                    <th className='data-cell'>Plants:</th>
                  </tr>
                  {mission.locations.map((location, index) => (
                    <tr>
                      <td className='data-cell-right'>{location}</td>
                    </tr>
                ))}
                </tbody>
              </table>

              <Button
                style={{
                  width: '100%',
                }}
                variant="outline-light"
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this mission?')) {
                    props.deleteMission(mission.mission_id);        
                  }
                }}
              >
                Delete Mission
              </Button>


              <Button
                style={{
                  width: '100%',
                }}
                variant="outline-light"
                onClick={() => props.robotCmd([5, mission.mission_id, 0, 0, 0])}
              >
                Run Mission
              </Button>
              <PlantSelectionPanel mission_index={index}/>
            </Accordion.Body>
          </Accordion.Item>
        ))
      ) : null}

      <Accordion.Item>
        <Accordion.Header>
          Add Mission
        </Accordion.Header>
        <Accordion.Body>
          <table
            style={{
              width: '100%',
            }}
          >
            <tbody>
              <tr>
                <th className='data-cell'>Mission Name:</th>
                <td className='data-cell-right'>
                  <input style={{ width: '120px' }} id="mission_name" type="text" placeholder="mission_0"/>
                </td>
              </tr>
              <tr>
                <th className='data-cell'>Hour</th>
                <td className='data-cell-right'>
                  <input style={{ width: '120px' }} id="hour" type="text" placeholder="Hour"/>
                </td>
              </tr>
              <tr>
                <th className='data-cell'>Minute</th>
                <td className='data-cell-right'>
                  <input style={{ width: '120px' }} id="minute" type="text" placeholder="Minute"/>
                </td>
              </tr>
              <tr>
                <th className='data-cell'>Action</th>
                <td className='data-cell-right'>
                <select id="action" name="Action" style={{ width: '120px' }}>
                  <option value="1">Sense</option>
                </select>
                </td>
              </tr>
            </tbody>
          </table>
          
          <Button
            style={{
              width: '100%',
            }}
            variant="outline-light"
            onClick={() => addMission(
              document.getElementById('mission_name').value,
              document.getElementById('action').value,
              document.getElementById('hour').value,
              document.getElementById('minute').value
            )}
          >
            Add Mission
          </Button>
          </Accordion.Body>
      </Accordion.Item>
    </Accordion>
    </div>
  );
});

export default SettingsPanel;







