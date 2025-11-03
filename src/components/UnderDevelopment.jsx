import kingLaughing from '../assets/king_laughing.gif';

export default function UnderDevelopment(props) {
    return <div>
        <h1 style={{position: 'fixed', top: 0, left: 0, right: 0, margin: 'auto', paddingTop: '12.2rem'}}>This page is currently under development, stay tuned!</h1>
        <img src={kingLaughing} alt='king laughing' style={{position: 'fixed', bottom: 0, left: 0, right: 0, margin: 'auto'}}/>
    </div>
}