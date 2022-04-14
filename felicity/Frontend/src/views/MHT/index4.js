import React from "react";
import Slider from '@material-ui/core/Slider';

import LogoImg from '../../Components/assets/Logo.png';
import { Label, Logo, MainContainer, QuestionContainer, SliderBox, SubmitButton, SubTitle, Title } from "./styles";
import UserRedirect from "../UserRedirect";

// const Check = () => {
//   const hurt = window.sessionStorage.getItem('hurt');
//   const depart = window.sessionStorage.getItem('depart');
//   const time = window.sessionStorage.getItem('time');
//   const where = window.sessionStorage.getItem('where');
//   return (<div>hurt: {hurt} depart: {depart} time: {time} where: {where}</div>);
// };

function MHT4() {

  const jwt = JSON.parse(sessionStorage.getItem("jwt"))

  function sessionStore () { //stores items in sessionStorage
    window.sessionStorage.setItem('level',value);
  }

  const [value, setValue] = React.useState(5);

  const severity = (event, newValue) => {setValue(newValue);};


  return (
    <MainContainer>
      {!jwt && <UserRedirect isRole={true}/>}
        <QuestionContainer>
            <Logo src={LogoImg}></Logo>
            <Title>Welcome!</Title>
            <SubTitle>Please fill out medical history form below (4/6)</SubTitle>
            <SubmitButton onClick={sessionStore} to={'/MHT5'}>
                Next</SubmitButton>
            <Label>4. How much does it hurt?  *</Label>
            <SliderBox>
              <Label>Mild</Label>
              <Slider 
              marks
              min={0}
              max={10}
              step={1}
              value={value}
              id="level"
              defaultValue={5}
              valueLabelDisplay="auto"
              onChange={severity} />
              <Label>Severe</Label>
            </SliderBox>
        </QuestionContainer>
    </MainContainer>
  );
}

export default MHT4;
