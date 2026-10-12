import TopBar from "../components/TopBar";
import MyGrowthTree from "../components/MyGrowthTree";
import ServicesList from "../components/ServicesList";
import LiveFeeds from "../components/LiveFeeds";
export default function Dashboard() {
  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden">


      {/* Top Bar */}
      <div className="relative z-10 w-full">
        <TopBar />
      </div>

      <div className="relative z-10 flex flex-col h-full pointer-events-none">
        {/* Enable pointer events for children */}
        <div className="pointer-events-auto w-full h-full flex flex-col">


          <div className="flex flex-1 gap-6 p-6">
            {/* CENTER - Growth Tree + Services List */}
            <div className="flex-1">
              <div className="flex flex-col items-center mb-12">
                <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-8 flex flex-col items-center border border-white/10 max-w-md w-full mb-8">
                  <MyGrowthTree />
                </div>

                <div className="w-full">
                  <h2 className="text-2xl font-bold text-neon mb-6 text-center">Our Services</h2>
                  <ServicesList />
                </div>
              </div>
            </div>


            {/* RIGHT */}
            <div className="w-80">
              <LiveFeeds />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
