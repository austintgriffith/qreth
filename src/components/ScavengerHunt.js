import React from 'react';
import { Events, Blockie, Scaler } from "dapparatus";
import cookie from 'react-cookies'
import Web3 from 'web3';
import Ruler from "./Ruler";
import axios from "axios"

export default class ScavengerHunt extends React.Component {

  constructor(props) {
    super(props);

    let ownerSalt = cookie.load('ownerSalt')
    if (!ownerSalt) {
      // Generate salt for owner 
      ownerSalt = props.web3.utils.sha3(""+Math.random())
      cookie.save('ownerSalt', ownerSalt, { path: '/'})
      console.log('Genrate ownerSalt: ', ownerSalt)
    } 

    let playerSalt = cookie.load('playerSalt')
    if (!playerSalt) {
      // Generate salt for player
      playerSalt = props.web3.utils.sha3(""+Math.random())
      cookie.save('playerSalt', playerSalt, { path: '/'})
      console.log('Genrate playerSalt: ', playerSalt)
    }

    let playerAnswers = cookie.load('playerAnswers')
    if (!playerAnswers) {
      playerAnswers = [];
    }

    let ownerAnswers = cookie.load('ownerAnswers')
    if (!ownerAnswers) {
      ownerAnswers = [];
    } else {
      ownerAnswers = JSON.parse(ownerAnswers)
    }

    this.state = {
      gameEndTime: 0,
      revealEndTime: 0,
      status: props.web3.utils.utf8ToHex('Pending'),
      winner: 0x0,
      view: "playerView",
      isOwner: false,
      numQuestions: 0,
      numPlayers: 0,
      numScavengerAnswers: 1,    // Owner Number of questions to create for scavenger hunt
      playerAnswers,
      ownerAnswers,
      ownerSalt,
      playerSalt,
      playerData: [0, 0],
      YourContract: false,
      yourContractBalance: 0,
      toAddress: (props.scannerState ? props.scannerState.toAddress : ""),
    }
  }

  componentDidMount(){
    console.log("YOUR MODULE MOUNTED, PROPS:",this.props)
    /*
        -- LOAD YOUR CONTRACT --
        Contract files loaded from:
        src/contracts/YourContract.abi
        src/contracts/YourContract.address
        src/contracts/YourContract.blocknumber.js // the block number it was deployed at (for efficient event loading)
        src/contracts/YourContrct.bytecode.js // if you want to deploy the contract from the module (see deployYourContract())
    */

    var urlParams = new URLSearchParams(window.location.search);
    var contractAddress = urlParams.get("game")

    console.log("contractadd ", contractAddress)

    if (!contractAddress) {
      this.setState({
      YourContract: this.props.contractLoader("ScavengerHunt")
      },()=>{
      console.log("YOURCONTRACT IS LOADED:",this.state.YourContract)
      })
    } else{
      this.setState({
        YourContract: this.props.contractLoader("ScavengerHunt", contractAddress)
      },()=>{
        console.log("YOURCONTRACT IS LOADED:",this.state.YourContract)
      }) 
    }

    setInterval(this.pollInterval.bind(this),2500)
    setTimeout(this.pollInterval.bind(this),30)
  }

  async pollInterval(){
    console.log("POLL")
    if(this.state && this.state.YourContract){
      let owner = await this.state.YourContract.owner().call();
      let isOwner = (owner == this.props.address);
      let status = await this.state.YourContract.status().call();
      let gameEndTime = await this.state.YourContract.gameEndTime().call();
      let revealEndTime = await this.state.YourContract.revealEndTime().call();
      let numQuestions = await this.state.YourContract.getNumQuestions().call();
      let numPlayers = await this.state.YourContract.getNumPlayers().call();
      let winner = await this.state.YourContract.winner().call();
      let yourContractBalance = await this.props.web3.eth.getBalance(this.state.YourContract._address)
      //let ensName = await this.props.ensLookup("austingriffith.eth")
      let mainnetBlockNumber = await this.props.mainnetweb3.eth.getBlockNumber()
      let xdaiBlockNumber = await this.props.xdaiweb3.eth.getBlockNumber()
      yourContractBalance = this.props.web3.utils.fromWei(yourContractBalance,'ether')
      let playerData = await this.state.YourContract.getPlayerData(this.props.address).call()

      this.setState({status, gameEndTime, revealEndTime, winner, isOwner, numQuestions, numPlayers, yourContractBalance,mainnetBlockNumber,xdaiBlockNumber, playerData})
    }
  }

  async submitAnswer(question) {
    let answer = document.getElementById("question_" + question).value
    console.log('answer', answer)
    let hashedAnswer = await this.state.YourContract.getSaltedHash(this.props.web3.utils.utf8ToHex(answer), this.state.playerSalt).call();
    this.props.tx(this.state.YourContract.commitAnswer(hashedAnswer, question), 160000, 0, 0, (result)=> {
      console.log(result);
      alert('Answer submitted')
    })
  }
 
  async revealAnswer(question) {
    let answer = document.getElementById("answer_" + question).value
    console.log('answer', answer)
    this.props.tx(this.state.YourContract.revealAnswer(this.props.web3.utils.utf8ToHex(answer), question, this.state.playerSalt), 160000, 0, 0, (result)=> {
      console.log('revealAnswer', result)
      alert('revealed Answer')
    })
  }

  clicked(name){
    console.log("clicked: ", name)
    switch (name) {
      case "ownerView":
      case "playerView":
      case "leaderBoardView":
        this.setState({view: name});
        break;
      case "endGame":
        let answers = [];
        for (let i = 0; i < this.state.numScavengerAnswers; i++ ) {
          answers.push(this.props.web3.utils.utf8ToHex(document.getElementById("scavengerAnswer_" + i).value))
        }
        console.log(answers, this.state.ownerSalt, parseInt(document.getElementById("revealEndTime").value))
        this.props.tx(this.state.YourContract.endGame(answers, this.state.ownerSalt, parseInt(document.getElementById("revealEndTime").value)), 120000, 0, 0, (result)=> {
          console.log(result);
        })
        break;
      case "findWinner":
        this.props.tx(this.state.YourContract.findWinner(), 120000, 0, 0, (result)=> {
          console.log(result);
        })
        break;
      case "removeAnswer":
        if (this.state.numScavengerAnswers > 1) this.setState({numScavengerAnswers: this.state.numScavengerAnswers - 1})
        break;
      case "addAnswer":
        this.setState({numScavengerAnswers: this.state.numScavengerAnswers + 1})
        break;
      default: console.log("secondary button "+name+" was clicked")
    }
    
    /*
    Time to make a transaction with YourContract!
    */
    // this.props.tx(this.state.YourContract.updateVar(name),120000,0,0,(result)=>{
    //   console.log(result)
    // })

  }

  hashAnswer(answer, salt) {
    return this.props.web3.utils.soliditySha3(this.props.web3.eth.abi.encodeParameters(['bytes32','bytes32'], [answer, salt]))
  }

  deployYourContract() {
    console.log("Deploying YourContract...")
    //
    //  as noted above you need src/contracts/YourContract.bytecode.js
    //  to be there for this to work:
    //

    // Get answers and hash
    let hashedAnswers = [];
    let ownerAnswer = [];
    for (let i = 0; i < this.state.numScavengerAnswers; i++ ) {
      let scavengerAnswer = document.getElementById("scavengerAnswer_" + i).value
      hashedAnswers.push(this.hashAnswer(this.props.web3.utils.utf8ToHex(scavengerAnswer), this.state.ownerSalt))
      ownerAnswer.push(scavengerAnswer)
    }

    cookie.save('ownerAnswer', JSON.stringify(ownerAnswer), { path: '/'})

    console.log(hashedAnswers, parseInt(document.getElementById("gameEndTime").value))
    
    // Deploy new contract with new params
    let code = require("../contracts/ScavengerHunt.bytecode.js")
    this.props.tx(this.state.YourContract._contract.deploy({data:code, arguments:[hashedAnswers, parseInt(document.getElementById("gameEndTime").value)]}),2000000,(receipt)=>{
      let yourContract = this.props.contractLoader("ScavengerHunt",receipt.contractAddress)
      this.setState({ YourContract: yourContract})
    })
  }
  render(){

    if(!this.state.YourContract){
      return (
        <div>
          LOADING YOURCONTRACT...
        </div>
      )
    }

    const questions = [];
    const answers = [];
    const scavengerAnswers = [];

    // submit answers
    for (let i = 0; i < this.state.numQuestions; i++) {
      questions.push(<div className="content bridge row">
      <div className="input-group">
        <div className="col-6 p-1">
        <div>
        <input type="text" className="form-control" placeholder={"Question " + i} id={"question_" + i}
        /></div>
        </div>
        <div className="col-6 p-1">
        <button className="btn btn-large w-100" style={this.props.buttonStyle.secondary} onClick={this.submitAnswer.bind(this,i)}>
          <Scaler config={{startZoomAt:400,origin:"50% 50%"}}>
            <i className="fas fa-dog"></i> {"Submit Question " + i}
          </Scaler>
        </button>
        </div>
      </div>
    </div>)
    }

    // reveal answers
    for (let i = 0; i < this.state.numQuestions; i++) {
      answers.push(<div className="content bridge row">
      <div className="input-group">
        <div className="col-6 p-1">
        <div>
        <input type="text" className="form-control" placeholder={"Enter Answer " + i} id={"answer_" + i}
        /></div>
        </div>
        <div className="col-6 p-1">
        <button className="btn btn-large w-100" style={this.props.buttonStyle.secondary} onClick={this.revealAnswer.bind(this,i)}>
          <Scaler config={{startZoomAt:400,origin:"50% 50%"}}>
            <i className="fas fa-dog"></i> {"Reveal Anwesr " + i}
          </Scaler>
        </button>
        </div>
      </div>
    </div>)
    }

    // Owner answers
    for (let i = 0; i < this.state.numScavengerAnswers; i++) {
      scavengerAnswers.push(<div className="content bridge row">
      <div className="input-group">
        <div className="col-12 p-1">
          <div>
            <input type="text" className="form-control" placeholder={"Enter Scavenger Answer " + i} id={"scavengerAnswer_" + i} /> 
          </div>
        </div>
      </div>
    </div>)
    }

    return (
      <div>
        <div className="form-group w-100">
            <div className="content bridge row">
            <div className="col-4 p-1">
              <button className="btn btn-large w-100" style={this.props.buttonStyle.secondary} onClick={()=>{
                this.clicked('ownerView')}
              }>
                <Scaler config={{startZoomAt:400,origin:"50% 50%"}}>
                  <i className="fas fa-bell"></i> {"Owner View"}
                </Scaler>
              </button>
            </div>
            <div className="col-4 p-1">
            <button className="btn btn-large w-100" style={this.props.buttonStyle.secondary} onClick={()=>{
              this.clicked('playerView')}
            }>
              <Scaler config={{startZoomAt:400,origin:"50% 50%"}}>
                <i className="fas fa-hand-holding-usd"></i> {"Player View"}
              </Scaler>
            </button>
            </div>
            <div className="col-4 p-1">
            <button className="btn btn-large w-100" style={this.props.buttonStyle.secondary} onClick={()=>{
              this.clicked("leaderBoardView")
            }}>
              <Scaler config={{startZoomAt:400,origin:"50% 50%"}}>
                <i className="fas fa-paw"></i> {"Leader Board"}
              </Scaler>
            </button>
            </div>
          </div>

          <div style={{width:"100%",textAlign:"center"}}>
            SCAVENGER HUNT Game:<br/> 
            {this.state.YourContract._address} 
            {this.props.web3.utils.hexToString(this.state.status) == "Start" &&
            <div>
              Game End Time: {(new Date(this.state.gameEndTime * 1000)).toString()}
            </div>
            }
            {this.props.web3.utils.hexToString(this.state.status) == "Reveal" &&
              <div>
                Reveal End Time: {(new Date(this.state.revealEndTime * 1000)).toString()} 
              </div>
            }

            <Ruler/>
            <div style={{padding:20}}>
              The logged in user is
              <Blockie
                address={this.props.address}
                config={{size:6}}
              />
              {this.props.address.substring(0,8)}
              <div>
                {this.props.dollarDisplay(this.props.balance)}<img src={this.props.xdai} style={{maxWidth:22,maxHeight:22}}/>
              </div>
              <div>
                {this.props.dollarDisplay(this.props.daiBalance)}<img src={this.props.dai} style={{maxWidth:22,maxHeight:22}}/>
              </div>
              <div>
                {this.props.dollarDisplay(this.props.ethBalance*this.props.ethprice)}<img src={this.props.eth} style={{maxWidth:22,maxHeight:22}}/>
              </div>
            </div>

            <Ruler/>

            <div>
              <h3>Status: {this.props.web3.utils.hexToString(this.state.status)} </h3>
            </div>
            <div>
              <h4>Number of Questions: {this.state.numQuestions} </h4>
            </div>
            <div>
              <h4>Player Score: {this.state.playerData[1] ? this.state.playerData[1] : 0} </h4>
            </div>
            
            {/* <div>
              Network {this.props.network} is selected and on block #{this.props.block}.
            </div>
            <div>
              Gas price on {this.props.network} is {this.props.gwei} gwei.
            </div>
            <div>
              mainnetweb3 is on block {this.state.mainnetBlockNumber} and version {this.props.mainnetweb3.version}
            </div>
            <div>
              xdaiweb3 is on block {this.state.xdaiBlockNumber} and version {this.props.xdaiweb3.version}
            </div>
            <div>
              The current price of ETH is {this.props.dollarDisplay(this.props.ethprice)}.
            </div> */}

            { this.state.view == "ownerView" ? (
              //////////////////////////////////////////////////////////////////////////////////////////////
              // Owner View
              //////////////////////////////////////////////////////////////////////////////////////////////
              <div>
                <Ruler/>
                
                <div className="content bridge row">
                  <div className="col-6 p-1">
                    <button className="btn btn-large w-100" style={this.props.buttonStyle.secondary} onClick={()=>{
                      this.clicked("removeAnswer")
                    }}>
                      <Scaler config={{startZoomAt:400,origin:"50% 50%"}}>
                        <i className="fas fa-minus"></i> {"Remove Answer"}
                      </Scaler>
                    </button>
                  </div>
                  <div className="col-6 p-1">
                    <button className="btn btn-large w-100" style={this.props.buttonStyle.secondary} onClick={()=>{
                      this.clicked("addAnswer")
                    }}>
                      <Scaler config={{startZoomAt:400,origin:"50% 50%"}}>
                        <i className="fas fa-plus"></i> {"Add Answer"}
                      </Scaler>
                    </button>
                  </div>
                </div>

                {scavengerAnswers}

                <div className="content bridge row">
                  <div className="input-group">
                    <div className="col-6 p-1">
                      <div>
                        <input type="text" className="form-control" placeholder={"Game End Time in Seconds"} id={"gameEndTime"} />
                      </div>
                    </div>
                  </div>
                  <div className="input-group">
                    <div className="col-6 p-1">
                      <div>
                        <input type="text" className="form-control" placeholder={"Reveal End Time in Seconds"} id={"revealEndTime"} />
                      </div>
                    </div>
                  </div>
                </div>

                <button className="btn btn-large w-100" style={this.props.buttonStyle.primary} onClick={this.deployYourContract.bind(this)}>
                  <Scaler config={{startZoomAt:400,origin:"50% 50%"}}>
                    <i className="fas fa-rocket"></i> {"Deploy Scavenger Contract"}
                  </Scaler>
                </button>

                <button className="btn btn-large w-100" style={this.props.buttonStyle.primary} onClick={() => {
                  this.clicked("endGame")
                }}>
                  <Scaler config={{startZoomAt:400,origin:"50% 50%"}}>
                    <i className="fas fa-rocket"></i> {"End Game"}
                  </Scaler>
                </button>

                <button className="btn btn-large w-100" style={this.props.buttonStyle.primary} onClick={() => {
                  this.clicked("findWinner")
                }}>
                  <Scaler config={{startZoomAt:400,origin:"50% 50%"}}>
                    <i className="fas fa-rocket"></i> {"Find Winner"}
                  </Scaler>
                </button>

              </div>


            ) : this.state.view == "playerView" ? (
              //////////////////////////////////////////////////////////////////////////////////////////////
              // Player View
              //////////////////////////////////////////////////////////////////////////////////////////////
              <div>

              {(this.props.web3.utils.hexToString(this.state.status) == "Start") ? questions : answers}
              
              <Ruler/>

              </div>
            ) : (
              //////////////////////////////////////////////////////////////////////////////////////////////
              // Leaderboard View
              ////////////////////////////////////////////////////////////////////////////////////////////// 
              <div>
                <h3>Leader Board</h3>
                <h4>Players: {this.state.numPlayers}</h4>
                <h4>Winner: {this.state.winner} </h4>

              <Ruler/>
              </div>
            )
            }

          </div>

          <Ruler/>



          <div className="content bridge row">
            <div className="col-4 p-1">
              <button className="btn btn-large w-100" style={this.props.buttonStyle.secondary} onClick={()=>{
                let toAddress = this.state.YourContract._address
                let amount = "0.1"
                this.props.send(toAddress, amount, 120000,"0x00", (result) => {
                  if(result && result.transactionHash){
                    console.log("RESULT&&&#&#&#&# ",result)
                  }
                })
              }}>
                <Scaler config={{startZoomAt:400,origin:"50% 50%"}}>
                  <i className="fas fa-arrow-circle-down"></i> {"deposit"}
                </Scaler>
              </button>
            </div>
            <div className="col-4 p-1">
            <div style={{padding:20,textAlign:'center'}}>
              Your contract is
              <Blockie
                address={this.state.YourContract._address}
                config={{size:3}}
              />
              {this.state.YourContract._address.substring(0,8)}

              <div style={{padding:5}}>
                it has {this.props.dollarDisplay(this.state.yourContractBalance)}
              </div>

            </div>
            </div>
            <div className="col-4 p-1">
            <button className="btn btn-large w-100" style={this.props.buttonStyle.secondary} onClick={()=>{
              let amount = this.props.web3.utils.toWei("0.1",'ether')
              this.props.tx(this.state.YourContract.withdraw(amount),40000,0,0,(result)=>{
                console.log("RESULT@@@@@@@@@@@@@@@@@&&&#&#&#&# ",result)
              })
            }}>
              <Scaler config={{startZoomAt:400,origin:"50% 50%"}}>
                <i className="fas fa-arrow-circle-up"></i> {"withdraw"}
              </Scaler>
            </button>
            </div>
          </div>

          <Ruler/>

          <div className="content row">
            <label htmlFor="amount_input">{"EXAMPLE ADDRESS INPUT:"}</label>
            <div className="input-group">
              <input type="text" className="form-control" placeholder="0x..." value={this.state.toAddress}
                ref={(input) => { this.addressInput = input; }}
                onChange={event => this.updateState('toAddress', event.target.value)}
              />
              <div className="input-group-append" onClick={() => {
                this.props.openScanner({view:"scavengerhunt"})
              }}>
                <span className="input-group-text" id="basic-addon2" style={this.props.buttonStyle.primary}>
                  <i style={{color:"#FFFFFF"}} className="fas fa-qrcode" />
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    )

  }
}
