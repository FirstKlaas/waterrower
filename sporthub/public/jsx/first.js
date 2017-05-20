var OppTable = React.createClass({
    getInitialState: function() {
        return {data: []};
    },
    handleSelection : function() {
        console.log('huhuhu');
    },
    componentDidMount: function() {
        $.ajax({
            url: this.props.url,
            dataType: 'json',
            cache: false,
            success: function(data) {
                this.setState({data: data});
            }.bind(this),
            error: function(xhr, status, err) {
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    },
    render: function() {
        var oppRows = this.state.data.map(opp => (
            <OppRow onSelect={this.handleSelection} key={opp.id} data={opp} />
        ));

        return (
            <div className="opp-table"  >
                {oppRows}
            </div>
        );
    }
});

var OppRow = React.createClass({
    getInitialState: function() {
        return {
            oppSelected: false,
            title: 'Mrs.'
        };
    },
    handleClick: function() {
        if (this.state.oppSelected) return;

        console.log("Click. Sending message");
        //this.props.onSelect();
        var data = {
            oppid : this.props.data.id
        };
        PubSub.publish( 'opp.selection', data);
    },
    handleMessage : function(msg, data ) {
        if (data.oppid == this.props.data.id) {
            if (!this.state.oppSelected) {
                console.log("Select");
                this.setState({oppSelected:true});
            }
        } else if(this.state.oppSelected) {
            this.setState({oppSelected:false});
        }

    },
    componentDidMount: function() {
        this.token =  PubSub.subscribe('opp.selection', this.handleMessage);
    },
    componentWillUnmount : function() {
        PubSub.unsubscribe( this.token );
    },
    render : function() {
        var s = this.state.oppSelected ? "Yes" : "No";
        return (
            <ul>
                <li onClick={this.handleClick}><b>{this.props.data.company}</b>
                    <br/>{this.props.data.name}
                    <br/>[{this.props.data.contact}]
                    <br/>Selected: {s}
                </li>

            </ul>
        );
    }
});

var OppDetails = React.createClass({
    getInitialState: function() {
        return {
            oppid: 0
        };
    },
    handleMessage : function(msg, data ) {
        this.setState({oppid:data.oppid});
    },
    componentDidMount: function() {
        this.token =  PubSub.subscribe('opp.selection', this.handleMessage);
    },
    componentWillUnmount : function() {
        PubSub.unsubscribe( this.token );
    },
    render : function() {
        return (
            <div>Details { this.state.oppid }</div>
        );
    }
});

ReactDOM.render(
    <OppDetails />,
    document.getElementById('mainData')
);


ReactDOM.render(
    <OppTable url="/opp/17/3" />,
    document.getElementById('react')
);


