/* eslint-disable react/no-children-prop */
/* eslint-disable react/forbid-prop-types */
import React, { useState } from 'react';
import { remote } from 'electron';
import { Button } from '@material-ui/core';
import PropTypes from 'prop-types';
import Error from '../../Error/Error';
import styles from './LinkedDescription.css';

const linkedDescription = props => {
  const [validationErrorMessage, setValidationErrorMessage] = useState(null);
  const [linkedUri, setLinkedUri] = useState(null);

  React.useEffect(() => {
    setLinkedUri(props.uri);
  }, [props.uri]);

  const handleBrowseFile = () => {
    remote.dialog
      .showOpenDialog({
        title: 'Select the file that contains the project description',
        properties: ['openFile'],
        defaultPath: props.projectPath
      })
      .then(result => {
        if (!result.canceled && result.filePaths !== null && result.filePaths.length > 0) {
          setLinkedUri(result.filePaths[0]);
          props.onChange(result.filePaths[0]);
        }
        return result;
      })
      .catch(err => {
        setValidationErrorMessage(`There was an error accessing the project root folder: ${err}`);
      });
  };

  let validation = null;
  if (validationErrorMessage) {
    validation = <Error style={{ marginTop: '15px' }}>{validationErrorMessage}</Error>;
  }
  console.log(linkedUri);
  const uriDescription =
    linkedUri === '' ? (
      <div>Please select the file that contains the project description</div>
    ) : (
      <div>Project description will be pulled from {linkedUri}</div>
    );
  return (
    <div className={styles.container}>
      {uriDescription}
      <Button color="primary" onClick={handleBrowseFile}>
        Select file
      </Button>
      {validation}
    </div>
  );
};

linkedDescription.propTypes = {
  uri: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  projectPath: PropTypes.string
};

linkedDescription.defaultProps = {
  projectPath: ''
};

export default linkedDescription;
